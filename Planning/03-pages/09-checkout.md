# TRD 09 — Checkout

## 1. Purpose & success metric

Turn a cart into a paid order with minimum friction; guest checkout is first-class. **KPI: checkout completion rate (begin_checkout → purchase, target ≥ 60%); guardrail: payment-failure rate < 5%.**

## 2. Route & rendering

- Route: `/checkout` — single-page accordion (contact → shipping → delivery method → payment), not multi-route steps; state lives in the Medusa cart between steps.
- Fully dynamic; `noindex`. Redirects to `/cart` when the cart is empty/invalid.
- Distraction-stripped layout: logo (links home via confirm dialog), steps, order summary; no header nav/footer links.

## 3. Layout & components

| Step | Component | Notes |
|---|---|---|
| 0 | `ExpressCheckout` | Apple Pay / Google Pay via Stripe Express Checkout Element at top — completes contact+shipping+payment in one sheet |
| 1 Contact | `ContactStep` | email (guest) with inline "Have an account? Sign in" (returns here after); signed-in users skip; newsletter opt-in checkbox **unticked** ([compliance](../04-cross-cutting/payments-and-compliance.md)) |
| 2 Shipping | `AddressStep` | address form with autocomplete-friendly `autocomplete` attributes; signed-in: saved-address picker ([TRD 18](18-addresses.md)) + "add new"; save-to-account checkbox |
| 3 Delivery | `ShippingMethodStep` | Medusa shipping options with prices; hazmat/ground-only restriction messaging where applicable |
| 4 Payment | `PaymentStep` | **Stripe Payment Element** (card/wallets); signed-in: saved-card picker ([TRD 17](17-saved-cards.md)) + "save this card" checkbox (SetupIntent flag); billing = shipping toggle; *(Razorpay option renders here for INR carts if open decision #1 lands on India — [addendum](../01-prerequisites/05-razorpay-addendum.md))* |
| Aside | `OrderSummary` | collapsible on mobile: lines, discount code, shipping, tax, total; live-updates per step |
| Trust | `TrustFooter` | payment badges, links to terms/privacy ("By placing this order you agree…"), support contact |

## 4. Data requirements

- Medusa: cart retrieval; update email/addresses; list+set shipping options; create/refresh payment session (→ Stripe PaymentIntent client secret); complete cart. All server actions.
- Stripe: Payment Element + Express Checkout Element with the client secret; saved cards listed via customer PaymentMethods (server).
- Payment-session creation rate-limited per [security doc](../04-cross-cutting/security-and-bots.md) (card-testing chokepoint); no Turnstile on checkout.
- Full payment sequence + webhook-as-source-of-truth: [payments-and-compliance](../04-cross-cutting/payments-and-compliance.md).

## 5. Interactions & states

- Steps validate on continue; completed steps collapse to summaries with "Edit". Cart edits happen back on `/cart` (summary links there).
- Address validation: required fields + postal-code format per country; errors inline, focus management to first error.
- Payment confirm: button locks with spinner ("Processing — don't refresh"); 3DS challenge handled by the Element in-flow.
- **Decline**: show gateway category message ("Your card was declined — try another payment method"), keep everything else filled, allow retry — new attempt reuses the PaymentIntent.
- **Success**: redirect to `/order/confirmed/{id}`; if cart completion lags the redirect (webhook race), confirmation page shows its processing state ([TRD 10](10-order-confirmation.md)).
- Stock-out during checkout (payment-session creation fails validation): return to cart with the offending line flagged.
- Session expiry (cart TTL) mid-checkout: friendly "cart expired" → `/cart`.
- Abandonment: email captured at step 1 + `Started Checkout` event powers Klaviyo flow M2 ([email-flows](../04-cross-cutting/email-flows.md)).

## 6. SEO

`noindex, nofollow`; robots-excluded. CSP restricting `script-src` to self + Stripe (+ consented analytics) per [security doc](../04-cross-cutting/security-and-bots.md).

## 7. Analytics events

`begin_checkout` (entry, items+value); `add_shipping_info` (`shipping_tier`); `add_payment_info` (`payment_type: card|wallet|upi`); `purchase` fires on the confirmation page, not here; PostHog per-step funnel events (`checkout_step_completed`, step name) — the funnel that finds drop-off.

## 8. Acceptance criteria

- [ ] Guest completes checkout with only email + address + test card; total time under 2 minutes.
- [ ] Signed-in user with saved address + card completes in ≤ 3 clicks after entry.
- [ ] Stripe test matrix passes: `4242…` success; `…9995` decline (graceful retry, data intact); `…3155` 3DS challenge.
- [ ] Express checkout (Apple Pay in Safari) produces a correct order with the wallet's address.
- [ ] Order totals (incl. discount + shipping) identical between summary, Stripe charge, and Medusa order.
- [ ] Refresh at every step resumes where the shopper left off (cart state persistence).
- [ ] Killing the tab after payment confirm still yields an order + confirmation email (webhook path).
- [ ] PostHog funnel shows all four steps; no third-party scripts on the page beyond payment + consented analytics.
