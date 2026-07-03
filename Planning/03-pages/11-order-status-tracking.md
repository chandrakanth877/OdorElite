# TRD 11 — Order Status & Tracking (incl. guest access)

## 1. Purpose & success metric

Let anyone — especially guests — check where their order is without contacting support. **KPI: "where is my order" (WISMO) support tickets per 100 orders < 2.**

## 2. Route & rendering

- `/order/status` — public lookup form (guest entry point).
- `/order/status/[token]` — tokenized status view (from confirmation page + all order emails).
- Signed-in customers are routed to `/account/orders/[id]` ([TRD 16](16-order-history.md)) instead; this surface exists primarily for guests.
- Fully dynamic, `noindex` (lookup form page itself may be indexed — buyers google "odorelite track order" — but token pages are `noindex`).

## 3. Layout & components

**Lookup form** (`/order/status`): order number + email fields, Turnstile (Managed), submit → "If that order exists, we've emailed a status link" (always the same response — no enumeration); sends email T8 with the tokenized link ([email-flows](../04-cross-cutting/email-flows.md)).

**Status page** (`/order/status/[token]`):

| Section | Component | Notes |
|---|---|---|
| Status timeline | `OrderTimeline` | placed → confirmed → shipped → out for delivery → delivered (canceled/refunded branch states); current stage highlighted with timestamp |
| Tracking | `TrackingCard` | carrier, tracking number linking to the carrier page (per fulfillment; split shipments = multiple cards) |
| Order summary | `OrderSummaryCard` | items, totals, **masked** email (`r***@gmail.com`), shipping city/state only pre-delivery, payment last-4 |
| Actions | `OrderActions` | contact support (order id pre-filled), returns-policy link; cancel button only while unfulfilled (creates a cancellation request) |
| Account nudge | `ClaimAccountCard` | guests: same claim flow as [TRD 10](10-order-confirmation.md) |

## 4. Data requirements

- Token model: `order_access_token` — raw token only in emails/links, SHA-256 at rest, 90-day expiry ([data model](../02-architecture/data-model.md), [security doc](../04-cross-cutting/security-and-bots.md)).
- Lookup: rate-limited 5/min/IP + Turnstile; match on (display order number + email) → email the link; **never render order data directly from the lookup**.
- Medusa: order with fulfillments + tracking numbers; cancellation request endpoint.
- Refund copy notes async settlement for Razorpay orders ([addendum](../01-prerequisites/05-razorpay-addendum.md)).

## 5. Interactions & states

- Expired token → "This link has expired" + lookup form (fresh token re-issued via email).
- Invalid/tampered token → same expired treatment (indistinguishable).
- Pre-shipment: timeline at "confirmed", tracking card replaced by ETA copy.
- Delivered: timeline complete + review-request CTA linking to the product PDPs.
- Canceled/refunded: distinct timeline branch with refund status copy.
- Cancel action: confirm dialog → request recorded → status "cancellation requested" (fulfillment race handled by support workflow, honest copy about it).

## 6. SEO

`/order/status` indexable (title `Track Your Order | OdorElite`); `/order/status/[token]` → `noindex, nofollow`, excluded from sitemap; tokens never appear in any crawlable link.

## 7. Analytics events

`page_view` (`page_type: order_status`); PostHog `order_lookup_submitted` (success/failure agnostic), `order_status_viewed` (stage), `order_cancel_requested`; `sign_up` (`method: post_purchase`) on account claim. No item-level commerce events here.

## 8. Acceptance criteria

- [ ] Full guest path: confirmation email link → status page with correct timeline, zero sign-in.
- [ ] Lookup with wrong email for a real order returns the identical neutral response as a nonexistent order.
- [ ] 6th lookup in a minute from one IP → rate-limited; missing Turnstile token → rejected.
- [ ] Marking a fulfillment shipped in admin updates the timeline and shows the carrier link.
- [ ] Token older than 90 days (or tampered) shows the expired state; re-lookup emails a fresh working link.
- [ ] Page leaks no full email, no full address pre-delivery, no payment data beyond last-4.
