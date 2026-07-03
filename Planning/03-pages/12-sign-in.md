# TRD 12 — Sign In

## 1. Purpose & success metric

Authenticate returning customers with minimal friction from any entry point (header, checkout, wishlist, review form). **KPI: sign-in success rate ≥ 85% of attempts; guardrail: password-reset rate.**

## 2. Route & rendering

- Route: `/sign-in?redirect={path}` — dynamic, `noindex`.
- Already-authenticated visitors are redirected to `redirect` or `/account`.
- `redirect` is validated as a same-origin relative path (open-redirect protection).

## 3. Layout & components

| Section | Component | Notes |
|---|---|---|
| Form | `SignInForm` | email, password (show/hide toggle), Turnstile (Managed, invisible-first), submit |
| Links | — | "Forgot password?" → [TRD 14](14-forgot-password.md); "New here? Create account" → [TRD 13](13-create-account.md) (carrying `redirect`) |
| Checkout variant | `SignInInline` | same form embedded in checkout step 1 without leaving `/checkout` ([TRD 09](09-checkout.md)) |

Minimal layout (header/footer present, no distractions). No social login in scope for v1 (revisit with data).

## 4. Data requirements

- Medusa auth: email/password → session (httpOnly cookie per [security doc](../04-cross-cutting/security-and-bots.md) — `Secure`, `SameSite=Lax`, ≤7d).
- Server action: verify Turnstile → rate limits (5/min/IP, 10/hr/email) → authenticate.
- Post-auth side effects: **merge guest cart** into customer cart ([TRD 08](08-cart.md) §4) and **merge guest wishlist** ([TRD 19](19-wishlist.md)); `identify` analytics profiles.

## 5. Interactions & states

- Errors: uniform "Invalid email or password" for both wrong-password and unknown-email (identical timing — [security doc](../04-cross-cutting/security-and-bots.md)); field-level errors only for format issues.
- Rate-limited: "Too many attempts — try again in a few minutes or reset your password."
- Success: redirect to validated `redirect` (default `/account`); header flips to account state; cart/wishlist badges update from merges.
- Loading: button spinner, form locked; Enter submits.
- Accessibility: labeled inputs, `autocomplete="email" / "current-password"` (password-manager friendly), error announcements via `aria-live`.

## 6. SEO

`noindex, nofollow`; excluded from sitemap. Title `Sign In | OdorElite`.

## 7. Analytics events

`login` (`method: email`) on success; PostHog `login_failed` (no email captured), `login_rate_limited`. Identity stitching (anonymous → customer id) happens here via `identify` ([tracking plan](../02-architecture/analytics-tracking-plan.md)).

## 8. Acceptance criteria

- [ ] Sign-in from header, checkout, wishlist, and review prompts all return to the originating context.
- [ ] Wrong password and unknown email produce byte-identical error responses.
- [ ] 6th attempt in a minute → rate-limited response; Turnstile-less scripted POST rejected.
- [ ] Guest cart with 2 items + account cart with 1 item → post-login cart has all 3.
- [ ] `redirect=https://evil.com` is ignored (lands on `/account`).
- [ ] Password managers autofill correctly on iOS Safari and Chrome.
