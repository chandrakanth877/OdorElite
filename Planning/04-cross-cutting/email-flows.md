# Email Flows

Complete inventory of every email the store sends. Hard split: **Resend sends transactional** (triggered by an order/account action, sent to everyone), **Klaviyo sends marketing** (behavioral/promotional, sent only to opted-in profiles). No email may exist in both systems.

Templates live in `packages/emails` (React Email) for Resend; Klaviyo templates are built in its editor. All triggers wire through Medusa subscribers per the [integration map](../02-architecture/integration-map.md).

## Transactional (Resend, from `orders@mail.odorelite.com`)

| # | Email | Trigger (Medusa event) | Template | Must contain |
|---|---|---|---|---|
| T1 | Order confirmation | `order.placed` | `order-confirmation` | order #, line items with images, totals, shipping address, **guest order-status link with access token** ([TRD 11](../03-pages/11-order-status-tracking.md)) |
| T2 | Shipping confirmation | fulfillment created with tracking | `shipping-confirmation` | carrier, tracking #/link, items shipped, ETA |
| T3 | Delivery notice *(if carrier webhook available)* | delivery event | `delivered` | review request CTA (links to PDP review form) |
| T4 | Order canceled | `order.canceled` | `order-canceled` | reason, refund expectation copy |
| T5 | Refund processed | `refund.created` | `refund-processed` | amount, method, settlement window (5–7 days copy for Razorpay orders) |
| T6 | Account welcome | `customer.created` | `account-welcome` | no promo content — just account link (keeps it transactional) |
| T7 | Password reset | `auth.password_reset` | `password-reset` | tokenized link, 1h expiry stated, "ignore if not you" |
| T8 | Guest order-status link (re-request) | guest lookup "email me my link" | `order-link` | tokenized status link |
| T9 | Back in stock | restock event × `restock_subscription` | `back-in-stock` | product card, PDP link; one-time per subscription |
| T10 | Contact/support acknowledgement | contact form submit | `support-ack` | ticket echo, response-time expectation |

Rules: no open/click tracking (link rewriting erodes trust); every template renders in Gmail/Outlook/iOS Mail; plain-text part always included; `reply_to: support@odorelite.com`.

## Marketing (Klaviyo, from `hello@send.odorelite.com`, opted-in only)

| # | Flow | Trigger | Sequence sketch |
|---|---|---|---|
| M1 | Welcome series | joins `Newsletter` list | 0h: welcome + first-order code · +2d: "how to choose a fragrance" (guide content) · +5d: bestsellers |
| M2 | Abandoned cart | `Added to Cart`, no `Placed Order` within 4h | 4h: reminder with cart contents · +24h: social proof/reviews · +48h: last call (no discount by default — test later) |
| M3 | Browse abandonment | `Viewed Product` ≥2, no cart in 24h | single email: viewed items + related picks |
| M4 | Post-purchase | `Placed Order` | +7d: care/usage tips · +14d: review request (skip if T3 already asked) · +30d: replenishment/cross-sell |
| M5 | Win-back | no order in 120d | 2 emails, 1 week apart |
| M6 | Back-in-stock (marketing variant) | Klaviyo restock subscribe *(only if not using T9 — pick one owner, default T9/Resend)* | — |
| M7 | Campaigns | manual | launches, seasonal gift guides, sales |

Rules: visible unsubscribe; suppress M2–M5 for anyone with an open support ticket or recent refund; global frequency cap 3/week.

## Consent & compliance

- Newsletter checkbox at checkout is **unticked by default**; footer signup is double-opt-in in GDPR regions ([compliance doc](payments-and-compliance.md)).
- Transactional emails ignore marketing opt-out (legitimate interest) but must contain zero promotional content to keep that status.
- DMARC alignment: Resend on `mail.`, Klaviyo on `send.` — never send either's mail through the other's domain.

## Acceptance

- Placing a test order produces T1 within 60s with a working guest-status link.
- Full T-series triggered in staging (order → ship → refund path) with every email rendering correctly in Gmail + Outlook.
- Klaviyo flows show as Live with the trigger events arriving from staging.
