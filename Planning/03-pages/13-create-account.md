# TRD 13 — Create Account

## 1. Purpose & success metric

Convert guests into account holders (higher LTV, saved details, wishlist persistence) via the standalone page and the post-purchase claim flow. **KPI: account-creation conversion from prompts (post-purchase claim rate target ≥ 20%).**

## 2. Route & rendering

- Route: `/create-account?redirect={path}` — dynamic, `noindex`; authenticated visitors redirected away.
- Second entry point: inline `ClaimAccountCard` on [order confirmation](10-order-confirmation.md) / [order status](11-order-status-tracking.md) (email pre-filled + locked, password only).

## 3. Layout & components

| Section | Component | Notes |
|---|---|---|
| Form | `CreateAccountForm` | first/last name, email, password with live strength meter (zxcvbn ≥ 3, min 10 chars — [security doc](../04-cross-cutting/security-and-bots.md)), Turnstile (Managed) |
| Consent | — | marketing opt-in checkbox **unticked** ([compliance](../04-cross-cutting/payments-and-compliance.md)); terms/privacy notice line |
| Links | — | "Already have an account? Sign in" (carrying `redirect`) |

No email verification gate for v1 (checkout re-validates email by receipt delivery); revisit if abuse appears.

## 4. Data requirements

- Server action: Turnstile → rate limit (3/hr/IP) → Medusa customer create + authenticate in one step.
- Existing-email conflict: respond "If this email is new, your account was created — otherwise check your inbox" AND send a "you already have an account" email — no enumeration via the form.
- Post-create: merge guest cart + wishlist (same as sign-in); `customer.created` subscriber sends welcome email T6 and identifies the Klaviyo profile (marketing subscribe only if opted in) ([integration map](../02-architecture/integration-map.md)).
- Claim variant: server action additionally links the just-placed guest order to the new customer.

## 5. Interactions & states

- Live password feedback (strength meter + requirement hints) before submit; weak password blocks with guidance.
- Success: auto-signed-in → `redirect` (default `/account` with a first-run welcome banner).
- Duplicate email: neutral response per §4 (UI shows success-style message either way).
- Claim-card variant: single password field; success swaps card to an order-history link.
- Accessibility: `autocomplete="new-password"`, error summaries `aria-live`.

## 6. SEO

`noindex, nofollow`. Title `Create Account | OdorElite`.

## 7. Analytics events

`sign_up` (`method: email` | `post_purchase`); Meta `CompleteRegistration`; PostHog `signup_password_rejected` (strength gate hits — measures friction). Identity `identify` on success.

## 8. Acceptance criteria

- [ ] Account created → auto signed in → welcome email T6 received.
- [ ] Registering an existing email shows the neutral message and triggers the "existing account" email; no boolean leak in response timing/shape.
- [ ] Guest wishlist and cart survive account creation (merged).
- [ ] Post-purchase claim: order appears in the new account's history; `sign_up` fires with `method: post_purchase`.
- [ ] 9-char or zxcvbn-2 password rejected with actionable copy.
- [ ] Marketing checkbox unticked by default; only opted-in profiles reach Klaviyo's marketing lists.
