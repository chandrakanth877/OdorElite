# Stripe

Primary payment gateway (see open decision #1 in the [overview](../00-overview.md) — if the store is India-first, read [05-razorpay-addendum](05-razorpay-addendum.md) and invert which gateway is primary).

## What it's for

- Card payments at checkout via **Payment Element** (single embedded component; also surfaces wallets — Apple Pay / Google Pay — with no extra integration).
- **Saved cards** for returning customers via SetupIntents + PaymentMethods ([17-saved-cards TRD](../03-pages/17-saved-cards.md)).
- **Radar** fraud scoring on every charge.
- Webhooks driving order state in Medusa ([integration map](../02-architecture/integration-map.md)).

## Tier & cost

Standard pay-per-transaction: 2.9% + 30¢ per successful card charge (US). No monthly fee. Radar is included with standard integration; Radar for Fraud Teams is extra — skip until fraud is observed.

## Setup steps

1. Create the account at stripe.com; complete business verification (legal entity, bank account) — required before live mode, takes days, so start early.
2. Toggle to **Test mode** for all development. Collect test keys from Developers → API keys.
3. Install the Medusa Stripe plugin (`@medusajs/payment-stripe`) in the backend and register it as the payment provider for the store's region.
4. Create the webhook endpoint: Developers → Webhooks → Add endpoint → `https://<backend-host>/hooks/payment/stripe` with events `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.amount_capturable_updated`, `charge.refunded`. Copy the signing secret.
5. In dev, use `stripe listen --forward-to localhost:9000/hooks/payment/stripe` instead of a public endpoint.
6. Enable Apple Pay: register the domain under Settings → Payment methods → Apple Pay (Vercel serves the association file from `/.well-known/`).
7. Repeat keys + webhook in **Live mode** at launch; live and test secrets are different env values, never reuse.

## Credentials to collect

| Env var | App | Where |
|---|---|---|
| `STRIPE_SECRET_KEY` | Medusa | Developers → API keys (`sk_test_…` / `sk_live_…`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | storefront | same page (`pk_test_…` / `pk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Medusa | the endpoint's signing secret (`whsec_…`) |

## OdorElite-specific configuration

- **Capture strategy**: automatic capture (fragrances ship fast; no need for auth-then-capture). Configure in the Medusa Stripe provider options.
- **Statement descriptor**: `ODORELITE` (Settings → Public details) — mismatched descriptors are the #1 chargeback cause.
- **SetupIntents** for the saved-cards page: create off-session usage (`usage: 'off_session'`) so saved cards can also fund future one-click flows.
- **Radar rules**: leave defaults; add a review rule for orders > $500 (fragrance resale fraud skews to high-value baskets).
- Test with `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (declined), `4000 0025 0000 3155` (3DS challenge) — all three must be covered in checkout QA ([09-checkout TRD](../03-pages/09-checkout.md)).

## You're done when…

- A test-mode checkout on the storefront completes, the webhook fires (visible in Stripe → Events), and the Medusa order flips to `captured`.
- The three test cards above produce success / graceful decline / 3DS challenge respectively.
