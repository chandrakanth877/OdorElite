# TRD 10 — Order Confirmation

## 1. Purpose & success metric

Reassure the buyer the order succeeded, set delivery expectations, and (for guests) hand them their tracking link + a soft account-creation offer. **KPI: reassurance is binary — support tickets asking "did my order go through?" ≈ 0; secondary: guest → account conversion rate on this page.**

## 2. Route & rendering

- Route: `/order/confirmed/[id]?key={display_key}` — dynamic, `noindex`.
- Access: signed-in owner sees it by session; guests authorized by a short-lived signed `key` query param issued at checkout redirect (prevents order-id enumeration). Expired/invalid → generic "check your email for your order details."

## 3. Layout & components

| Section | Component | Notes |
|---|---|---|
| Confirmation header | `OrderConfirmedHero` | check icon, "Thanks — your order is confirmed", order number, email-sent-to line |
| **Processing variant** | `OrderProcessing` | when payment succeeded but the webhook hasn't completed the order yet: "Payment received — finalizing your order", auto-refresh/poll every 3s (max 60s) then fallback copy pointing at email; **never an error** ([payments doc](../04-cross-cutting/payments-and-compliance.md)) |
| Order summary | `OrderSummaryCard` | line items with thumbs, totals, shipping address, delivery method + ETA, payment method (last-4/wallet) |
| Status link | `TrackOrderCta` | signed-in → `/account/orders/{id}`; guest → tokenized `/order/status/{token}` link ([TRD 11](11-order-status-tracking.md)) with "we also emailed you this link" |
| Guest account offer | `ClaimAccountCard` | guests only: "Create a password to track orders & save your details" — email pre-filled, one password field, converts the guest order to the new account ([TRD 13](13-create-account.md)) |
| Cross-sell | `ProductRail id=rec_confirmation` | "complete your collection" FBT ([search doc](../04-cross-cutting/search-and-recommendations.md)) |
| Support | `SupportStrip` | contact link, returns-policy link |

## 4. Data requirements

- Medusa: order by id (server-side; verify session ownership or `key` signature).
- Poll endpoint for the processing state: lightweight order-exists check by cart id.
- Confirmation email (T1) is sent by the `order.placed` subscriber, not this page ([email-flows](../04-cross-cutting/email-flows.md)).

## 5. Interactions & states

- Processing → confirmed transition happens in-place when polling succeeds.
- Refresh/revisit: page is idempotent and shows the same confirmed state (the `purchase` analytics event is guarded — see §7).
- Guest account creation inline: success swaps the card for "You're set — view your order" → `/account/orders/{id}`.
- Direct visits with a stale/expired `key`: neutral fallback, no order data leaked.

## 6. SEO

`noindex, nofollow`; excluded from sitemap and robots-allowed paths.

## 7. Analytics events

`purchase` — the canonical client-side firing point (order id as `transaction_id`, full items, value/tax/shipping/coupon), guarded by `sessionStorage` key on order id so refreshes never double-fire; server-side mirrors (Meta CAPI, Klaviyo `Placed Order`) fire from the subscriber with `event_id = order_id` for dedup ([tracking plan](../02-architecture/analytics-tracking-plan.md)); `sign_up` (`method: post_purchase`) when the guest claims an account; `select_item` on the cross-sell rail.

## 8. Acceptance criteria

- [ ] Normal flow: redirect lands on a fully confirmed page with accurate order data.
- [ ] Simulated webhook delay (pause the webhook forwarder): page shows the processing state, then flips to confirmed when the webhook lands — no error shown at any point.
- [ ] Refreshing the page 3× produces exactly one GA4 `purchase` and Meta shows client+server events deduplicated.
- [ ] Guest sees the tokenized status link and it works logged-out; signed-in user sees the account link instead.
- [ ] Guest account claim converts the order (it appears in the new account's history).
- [ ] Tampered `key` yields the neutral fallback with no order details.
