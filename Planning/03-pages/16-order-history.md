# TRD 16 — Order History (list + detail)

## 1. Purpose & success metric

Signed-in equivalent of guest order tracking: every past order, its status, and per-order actions (track, reorder, return). **KPI: WISMO tickets from account holders ≈ 0; secondary: reorder rate.**

## 2. Route & rendering

- `/account/orders` — paginated list.
- `/account/orders/[id]` — order detail.
- Dynamic, auth-required within `AccountLayout` ([TRD 15](15-account-overview.md)), `noindex`. Detail route verifies the order belongs to the session customer (404 otherwise — not 403, no existence leak).

## 3. Layout & components

**List**: `OrderCard[]` — order number, date, status chip (processing / shipped / delivered / canceled / refunded), total, first 3 item thumbs (+N), View button. Filter tabs: All / In progress / Delivered / Canceled. Pagination 10/page. Empty state → bestsellers.

**Detail** (shares components with [TRD 11](11-order-status-tracking.md)):

| Section | Component | Notes |
|---|---|---|
| Header | order number, placed date, status chip | |
| Timeline | `OrderTimeline` | same component as guest status page |
| Tracking | `TrackingCard[]` | per fulfillment (split shipments) |
| Items | `OrderLineList` | full lines with links back to PDPs; per-line "Buy again"; review CTA on delivered items (links to PDP review form, [TRD 06](06-product-detail.md)) |
| Totals | `OrderTotals` | subtotal/discount/shipping/tax/total, payment method last-4 |
| Addresses | shipping + billing | full addresses (authenticated context — unlike the masked guest view) |
| Actions | `OrderActions` | reorder all, cancel (unfulfilled only), start return (delivered, within policy window → support form pre-filled), invoice download (Phase 3) |

## 4. Data requirements

- Medusa: customer orders list (paginated, status-filterable); order detail with fulfillments, tracking, payments. All scoped to the authenticated customer server-side.
- Reorder/cancel via the same server actions as [TRD 15](15-account-overview.md) / [TRD 11](11-order-status-tracking.md).

## 5. Interactions & states

- Status chips derive from one shared mapping (Medusa fulfillment/payment states → display states) used by list, detail, and guest page — no divergent status logic.
- Reorder: same semantics as overview (report unavailable lines).
- Cancel: confirm dialog → request state; UI reflects "cancellation requested" immediately.
- Return: only within the returns window ([policy](../04-cross-cutting/payments-and-compliance.md)); outside it, the action explains why it's unavailable.
- Deep link to another customer's order id → 404.

## 6. SEO

`noindex, nofollow`; under the `/account` robots disallow.

## 7. Analytics events

PostHog `order_history_viewed`, `order_detail_viewed` (status), `return_started`; `add_to_cart` (`source: buy_again`). Review CTA clicks tracked as PostHog `review_cta_clicked`.

## 8. Acceptance criteria

- [ ] All orders (including pre-account guest orders claimed at signup) appear, newest first; filters correct.
- [ ] Detail matches the confirmation email for the same order (spot-check totals + lines).
- [ ] Split shipment shows two tracking cards with distinct numbers.
- [ ] "Buy again" on a price-changed item adds at the current price with a notice.
- [ ] Another customer's order id returns 404.
- [ ] Status chip vocabulary identical across list, detail, and guest status page.
