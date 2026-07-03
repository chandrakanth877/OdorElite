# Razorpay (Addendum — India / UPI)

**Optional.** Only needed if open decision #1 ([overview](../00-overview.md)) resolves to serving India, where UPI dominates and Stripe has limited support. If India-first, Razorpay becomes the primary gateway and Stripe handles international cards.

## What it's for

UPI, netbanking, Indian cards, and wallets at checkout, via Razorpay Standard Checkout embedded in the same checkout page ([09-checkout TRD](../03-pages/09-checkout.md)).

## Tier & cost

Standard pricing: 2% per domestic transaction (UPI sometimes promotional/lower), 3% international. No monthly fee.

## Setup steps

1. Sign up at razorpay.com. **KYC is mandatory before live mode**: Indian business entity (or sole proprietorship), PAN, bank account, business proof. Budget 1–2 weeks; test mode works immediately.
2. Collect test keys: Dashboard → Settings → API Keys → Generate Test Key.
3. Install a Medusa Razorpay payment provider (community plugin, e.g. `medusa-payment-razorpay`) and register it alongside Stripe; Medusa supports multiple providers per region, so the checkout can offer both.
4. Webhooks: Settings → Webhooks → add `https://<backend-host>/hooks/payment/razorpay` with events `payment.captured`, `payment.failed`, `refund.processed`. Set and record the webhook secret.
5. Enable payment methods in Dashboard → Settings → Payment Methods: UPI, cards, netbanking; leave EMI/paylater off initially.

## Credentials to collect

| Env var | App | Where |
|---|---|---|
| `RAZORPAY_KEY_ID` | Medusa + storefront (key id is public) | Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | Medusa | same |
| `RAZORPAY_WEBHOOK_SECRET` | Medusa | webhook settings |

## Differences from the Stripe flow to account for

- **Currency**: INR only for domestic methods; the Medusa region for India must be INR-denominated. This forces the multi-currency decision (open decision #2).
- **Saved cards**: Razorpay tokenization (RBI-mandated) replaces Stripe SetupIntents on the [saved-cards page](../03-pages/17-saved-cards.md) for Indian cards; UPI has no equivalent — hide "save for later" for UPI payments.
- **Refunds** are asynchronous (up to 5–7 days to settle); the [order-status page](../03-pages/11-order-status-tracking.md) copy must not promise instant refunds for Razorpay orders.

## You're done when…

- A test-mode UPI payment (`success@razorpay` VPA) completes and the webhook flips the Medusa order to `captured`.
