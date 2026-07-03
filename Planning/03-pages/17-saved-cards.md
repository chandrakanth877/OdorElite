# TRD 17 — Saved Cards

## 1. Purpose & success metric

Manage stored payment methods so repeat checkout is near-instant. **KPI: share of repeat purchases using a saved card ≥ 50%; guardrail: zero card-data exposure (PCI SAQ A preserved — [security doc](../04-cross-cutting/security-and-bots.md)).**

## 2. Route & rendering

- Route: `/account/saved-cards` — dynamic, auth-required, `AccountLayout`, `noindex`.

## 3. Layout & components

| Section | Component | Notes |
|---|---|---|
| Card list | `PaymentMethodCard[]` | brand icon, `•••• {last4}`, expiry, default badge; expired cards flagged "Expired"; expiring within 60d flagged "Expires soon" |
| Actions per card | — | set default, remove (confirm dialog) |
| Add card | `AddCardForm` | **Stripe Payment Element in setup mode** mounted from a server-created SetupIntent (`usage: 'off_session'`) — card data goes only to Stripe |
| Empty state | — | explainer: "Save a card at checkout or add one here" |

## 4. Data requirements

Stripe-native flow; Medusa stores only the Stripe customer id:

1. Ensure a Stripe Customer exists for the Medusa customer (create lazily, store `stripe_customer_id` on customer metadata).
2. **Add**: server action creates a SetupIntent for that customer → client confirms in the Element → PaymentMethod attaches to the customer.
3. **List**: server-side `paymentMethods.list` (type `card`) — only brand/last4/expiry ever reach the client.
4. **Remove**: `paymentMethods.detach`; **default**: set `invoice_settings.default_payment_method` (and mirror as metadata for checkout preselection).
5. Checkout ([TRD 09](09-checkout.md)) lists the same methods for one-click selection; "save this card" at checkout sets `setup_future_usage` on the PaymentIntent — both paths land in the same list.

Razorpay parallel (if open decision #1 activates it): RBI tokenization replaces SetupIntents for Indian cards; UPI is never saveable ([addendum](../01-prerequisites/05-razorpay-addendum.md)).

## 5. Interactions & states

- Add: Element handles validation/3DS for the setup confirmation; success appends the card without a full reload.
- Remove default card: next-most-recent becomes default (explicit in the confirm copy); removing the last card returns to empty state.
- A card in-flight on an active subscription/off-session use isn't a concern for v1 (no subscriptions) — plain detach.
- Failure states: SetupIntent confirmation failure surfaces the gateway message inline; list failure shows retry.

## 6. SEO

`noindex, nofollow`; robots-disallowed under `/account`.

## 7. Analytics events

PostHog only (no card metadata beyond brand): `card_added` (brand), `card_removed`, `card_default_changed`. No GA4/Meta events.

## 8. Acceptance criteria

- [ ] Adding `4242…` shows Visa `•••• 4242` in the list and in checkout's saved-card picker.
- [ ] "Save this card" during a checkout purchase makes it appear here afterward.
- [ ] Remove detaches in Stripe (verify in dashboard) and disappears from checkout.
- [ ] A 3DS-required test card completes setup via the challenge flow.
- [ ] No network response to the browser ever contains a PAN or full expiry+number pair (inspect all API payloads).
- [ ] Expired card shows flagged and is not preselected at checkout.
