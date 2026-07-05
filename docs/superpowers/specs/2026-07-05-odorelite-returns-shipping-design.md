# OdorElite — Returns Flow + Simulated Shipping Partner

Companion to the master spec (`2026-07-04-odorelite-prototype-pages-design.md`).
Adds two capabilities to the 19-page prototype: a full self-service returns flow
(Walmart/Amazon pattern) and a simulated shipping-partner integration that fires
at order placement (Shippo/EasyPost pattern). No backend; everything runs on the
existing localStorage store.

Research grounding (2026-07-05):
- Shipping API contract mirrored from Shippo (rates -> buy label/transaction ->
  tracking with status enum PRE_TRANSIT/TRANSIT/DELIVERED/RETURNED) and EasyPost
  (top-level out_for_delivery status, tracker.updated webhooks). Both vendors do
  test mode via magic tracking numbers that force a state; our demo controls
  copy that idea.
- Returns UX mirrored from Walmart ("Start a return": items -> reason ->
  method -> review, store QR / mail label) and Amazon (canonical reason list,
  QR drop-off "no box, no label", refund at first scan for drop-off, "Return
  by [date]" deadline, return status ladder: started -> shipped/dropped off ->
  received -> refund issued).

## 1. Decisions (locked with user)

1. Shipping partner is **simulated in-prototype** (module shaped like the real
   APIs, swappable later). No real API calls, no keys.
2. Returns are a **full wizard, refund only** (no replacements/exchanges).
3. Time model is **accelerated + demo controls**: a shipment plays label ->
   delivered over ~10 real minutes, and demo buttons can jump it forward.

## 2. Architecture: lazy deterministic simulation

No timers, no daemons. At label purchase the module stamps a deterministic
**schedule** (list of future events with absolute timestamps). Whenever a page
reads an order, `OEShip.reconcile(order)` appends any events whose time has
come and syncs order status. This is the webhook analogue: reconcile = the
handler a merchant backend would run on `track_updated`. Survives reloads,
works on every page, multi-tab safe (localStorage writes are idempotent:
events are appended only if their status is not already present).

The track page adds a 30-second interval (reconcile + re-render) so a shipment
visibly moves while the user watches. No other page polls.

Demo controls call `OEShip.advance(...)`, which shifts remaining schedule
timestamps into the past so the next reconcile fires them — the in-prototype
equivalent of Shippo's `SHIPPO_DELIVERED` / EasyPost's `EZ4000000004` magic
tracking numbers.

## 3. New module: `prototype/shared/shipping.js` (`window.OEShip`)

Loaded after store.js on pages that need it (checkout, confirmation, track,
orders, returns, label). ES5, IIFE, same style as store.js.

### 3.1 Carrier config

| speed key (checkout) | carrier | service name | tracking format |
|---|---|---|---|
| `standard` | USPS | Ground Advantage | 22 digits starting `9400` |
| `express` | UPS | 2nd Day Air | `1Z` + 16 alphanumeric (`1ZOE...`) |
| `overnight` | FedEx | Priority Overnight | 12 digits |

Tracking numbers are generated deterministically from the order id (hash31,
same pattern as `OEUI.pdpBucket`), so re-renders and re-seeds are stable.
Return shipments always use UPS (prepaid mail) — matching the "return carrier
matches outbound where possible, UPS Store for drop-off" real-world pattern.

### 3.2 API surface (Shippo-shaped)

```js
OEShip.getRates(speed)      // -> [{carrier, service, amount, estDays}] for display
OEShip.buyLabel(opts)       // opts: {orderId, speed, isReturn, qrRequested, rmaId}
                            // -> shipment object (below); pure function of inputs + now
OEShip.reconcile(order)     // appends due events to order.shipment and each
                            // order.returns[i].shipment; syncs order.status,
                            // order.timeline, order.fulfillments, return status
                            // + refund issuance. Returns true if anything changed
                            // (caller persists via OEStore.orders.update and
                            // re-renders).
OEShip.advance(shipment, n) // demo control: pulls the next n scheduled events
                            // (default 1) into the past. Caller reconciles after.
OEShip.advanceAll(shipment) // jump to final state (Deliver now / Mark received)
```

### 3.3 Shipment object (stored on the order)

```js
{
  carrier: "UPS", service: "2nd Day Air",
  trackingNumber: "1ZOE4X92A0301142",
  labelUrl: "../label/?order=OE-2026-00342",         // or &rma=RMA-... for returns
  qrCode: false,                                      // true for drop-off returns
  isReturn: false,
  eta: 1751742000000,                                 // ms timestamp
  status: "pre_transit",                              // current, derived at reconcile
  schedule: [ {status, detail, location, at}, ... ],  // stamped at buy, immutable
  events:   [ {status, detail, location, at}, ... ]   // grows as schedule comes due
}
```

Statuses (lowercase, EasyPost-style since it has top-level out_for_delivery):
`pre_transit` -> `in_transit` -> `out_for_delivery` -> `delivered`.
Return shipments use: `pre_transit` -> `in_transit` -> `delivered` (delivered =
received at warehouse); QR drop-off returns get a distinct first event
"Dropped off - package scanned at The UPS Store".

Event details are realistic Shippo-style strings with locations derived
deterministically from the tracking number (e.g. "Departed facility" +
"Secaucus, NJ" / "Memphis, TN" pools per carrier).

### 3.4 Accelerated schedule

Offsets from label purchase: +0 label created (pre_transit), +2 min picked up
(in_transit), +4 min departed facility (in_transit), +7 min out for delivery,
+10 min delivered. Overnight compresses to 6 min total, standard stays 10.
Return schedules: +0 label/QR created, then nothing until the user "ships" it
implicitly — first transit event at +3 min, received at +8 min. The `eta`
shown in UI copy stays the honest days-based date (reuses the existing
arrival-date language); the accelerated clock only drives event firing. This
mismatch is acceptable: the footer already discloses demo data, and demo
viewers care about seeing movement, not date math.

### 3.5 Status sync rules (reconcile)

Outbound shipment -> order: first `in_transit` event sets order status
`shipped`; `out_for_delivery` and `delivered` map 1:1. Each transition appends
to `order.timeline` (existing shape) and the first one populates
`order.fulfillments = [{carrier, tracking, url: "../track/?id=...&key=..."}]`
so the existing `OEUI.trackingCard` keeps working. Canceled orders are never
reconciled.

Return shipment -> return record: `pre_transit` = return status `started`;
first `in_transit` = `in_transit`; `delivered` = `received`, then `refunded`
is appended immediately after `received` for mail returns. QR drop-off
returns refund at first scan: the drop-off event itself triggers `refunded`
(Amazon "refund issued when drop-off is complete" pattern). Refund issuance
stamps `refund.issuedAt` and a `refundNote` string ("Refund of $X.XX issued to
Visa ****4242. Allow 5-10 business days.") — same copy pattern the canceled
seed order already uses.

## 4. Data model additions (`prototype/shared/store.js`)

Order gains two optional fields (absent on legacy orders is handled):

- `shipment` — object per 3.3, created at checkout placement and by seeds.
- `returns` — array of return records:

```js
{
  id: "RMA-84213",                       // deterministic-ish, uid-based
  createdAt: ts,
  returnBy: ts + 30 days,
  lines: [{id, qty}],                    // subset of order lines, partial qty ok
  reason: {key: "defective", label: "Item defective or does not work"},
  comments: "",
  method: "dropoff" | "mail",
  resolution: "refund",
  refund: {amount, network, last4, issuedAt|null},   // amount = sum(price*qty)*1.0825, rounded
  shipment: {...},                       // OEShip shipment with isReturn:true
  status: "started"|"in_transit"|"received"|"refunded"|"canceled",
  timeline: [{status, at}]
}
```

New store API: `OEStore.returns.create(orderId, ret)`,
`OEStore.returns.cancel(orderId, rmaId)` (allowed only while status is
`started`), plus `OEStore.orders.returnableQty(order, lineId)` = qty minus
quantities already in non-canceled returns.

Refund math: item price x qty x (1 + 0.0825), rounded to cents. Shipping is
not refunded. Discounts are ignored in refund math (documented
simplification; the demo discount is order-level and apportioning it adds no
demo value).

Seeds: `seedOrder` builds `shipment` via OEShip (schedules positioned so
seeded statuses hold: delivered orders have complete event history, the
shipped order is mid-flight with its next event ~2 min out — instant demo
movement). Seeded delivered order OE-2026-00297 gains one completed
(refunded) return. Seed flag value bumps `"1"` -> `"2"` so existing browsers
reseed; `OEStore.reset()` unchanged.

## 5. Page changes

### 5.1 Checkout (`prototype/checkout/app.js`)

At place-order: `OEShip.buyLabel({orderId, speed: state.shipping})` attached
as `order.shipment` before `OEStore.orders.add`. No UI change in the steps
(rates already display as the three shipping radios; their prices stay as-is).

### 5.2 Confirmation (`prototype/confirmation/`)

New "Shipping" card once the processing->confirmed flip completes: carrier +
service, tracking number linking to the track page, ETA line, "Label created"
chip. Reads `order.shipment`; hidden for legacy orders without one.

### 5.3 Track (`prototype/track/`)

- Carrier events feed under the timeline: reverse-chronological rows
  (detail, location, time) from `shipment.events`; replaces nothing —
  `trackingCard` stays.
- Returns section: one card per return — RMA id, status chip, mini timeline
  (started -> dropped off/in transit -> received -> refunded), label/QR link.
- Demo controls: quiet bordered card at the bottom, heading "Demo controls
  (prototype only)": buttons "Advance one step" and "Deliver now" for the
  outbound shipment; "Advance return" per active return. Hidden when
  everything is terminal.
- 30-second reconcile+rerender interval while the page is open.

### 5.4 Orders (`prototype/orders/`)

- "Start return" mailto replaced by a link to
  `../returns/?order=<id>` — shown when order delivered, window open (existing
  30-day logic), and any line has returnableQty > 0. Window-closed disabled
  button stays as-is.
- Detail view: "Returns" section listing each return (RMA, date, status chip,
  refund note when refunded) linking to `../returns/?order=<id>&rma=<id>`.
- New filter tab "Returns" (orders having returns.length > 0).
- Cancel return button on returns still in `started`.
- Page calls reconcile on load (via a small shared helper used by orders,
  track, account overview).

### 5.5 NEW: Returns wizard (`prototype/returns/`)

`returns/?order=<id>` — wizard mode; `...&rma=<id>` — status mode for an
existing return. Auth-gated like orders (`OEUI.requireAuth`); guests reach
returns via track page only in status (read-only) mode using the existing
`token`/`key` params.

Wizard: checkout-style accordion, 4 steps.
1. **Items** — delivered lines with image, checkbox, qty stepper capped at
   returnableQty. At least one required.
2. **Reason** — radio list (single reason applies to the whole return, Walmart
   pattern): No longer needed / Bought by mistake / Item defective or does not
   work / Damaged in shipping / Wrong item was sent / Not as described /
   Arrived too late / Better price available. Comments textarea: required
   (min 20 chars) for defective/damaged, optional otherwise.
3. **Return method** — two selectable cards (same visual kit as checkout's
   fulfillment cards): "Drop off with QR code" (No box, no label, no tape.
   Show the QR at any drop-off point. Refund issued when your drop-off is
   scanned.) and "Return by mail" (Prepaid UPS label to print. Refund issued
   when we receive your item.).
4. **Review & submit** — items, reason, method, refund summary ("$X.XX to
   Visa ****4242, 5-10 business days after refund is issued"), "Return by
   <date>" deadline. Submit creates the return (store + OEShip label), then
   swaps to confirmation state: RMA number, QR code or "Print label" button
   (-> label page), what-happens-next copy, link back to order.

Status mode: return summary, timeline, events feed, label/QR link, cancel
button while `started`, demo-advance button (same demo-controls styling).

### 5.6 NEW: Label page (`prototype/label/`)

`label/?order=<id>` (outbound) or `label/?order=<id>&rma=<id>` (return).
Renders a 4x6-proportioned label card: carrier wordmark (text), from/to
addresses, service, tracking number, CSS-stripe Code128-look barcode
(deterministic stripe widths from the tracking number), and for QR returns a
deterministic fake QR block (CSS grid cells from hash bits). Watermark strip:
"DEMO LABEL - not valid for shipping". Print stylesheet (`@media print`:
chrome hidden, label centered). Minimal chrome (like checkout's minimal
mode). Not listed in nav; reached only from confirmation/track/returns.

### 5.7 Shared

- `OEUI.STATUS_META` additions: `return_started` (Return started, chip-info),
  `return_in_transit` (Return in transit, chip-accent), `return_received`
  (Return received, chip-info), `refund_issued` (Refunded, chip-success) —
  used by returns/orders/track chips via a `returnChip(ret)` helper.
- `chrome.js` footer demo line (both variants) extends to: "Ratings, review
  counts, delivery dates and carrier tracking events are demo data."
- shared.css: events-feed rows, demo-controls card, wizard bits that are not
  page-specific stay in `returns/styles.css`.

## 6. Error handling & edge cases

- Legacy orders (pre-shipment field): reconcile no-ops, track page falls back
  to current behavior, no Start return regression (window logic unchanged).
- Order fully returned: Start return link disappears (returnableQty = 0).
- Multiple returns per order allowed until quantities exhaust.
- Cancel return: only from `started`; sets status `canceled`, restores
  returnableQty, keeps the record visible (grayed) in the order's Returns list.
- Canceled/refunded orders: no shipment reconcile, no returns entry point.
- Clock skew/localStorage tampering: reconcile only ever appends events whose
  status is not already present, in schedule order — idempotent.
- Zero console errors, WCAG AA (chips reuse existing token pairs; demo
  controls are real buttons with labels), no em-dashes in visible copy,
  prefers-reduced-motion respected (no new animation beyond existing kit).

## 7. Testing (browser verification via Playwright MCP)

1. Guest purchase -> confirmation shows label card -> track page events appear
   over time; "Deliver now" jumps to delivered and order status follows.
2. Signed-in delivered order -> full wizard (partial qty, defective reason
   forces comments, QR method) -> confirmation with QR -> demo-advance ->
   refund note appears on order detail; refunded chip in Returns tab.
3. Mail-label return -> label page renders + print stylesheet sanity check.
4. Cancel a just-created return -> quantities restored, wizard available again.
5. Seed reset -> seeded shipped order moves within ~2 minutes on track page.
6. Regression: all 19 (now 21) pages, 1440px + 390px, zero console errors.

## 8. Out of scope

Real carrier APIs, exchanges/replacements, return shipping fees, email
notifications, multi-address returns, international, insurance/claims,
scan-based label billing simulation.
