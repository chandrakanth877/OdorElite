# TRD 14 — Forgot / Reset Password

## 1. Purpose & success metric

Self-service recovery without leaking which emails have accounts. **KPI: reset completion rate (request → new password set) ≥ 70%; support tickets for lockouts ≈ 0.**

## 2. Route & rendering

- `/forgot-password` — request form.
- `/reset-password?token={t}` — set-new-password form (from email T7).
- Both dynamic, `noindex`.

## 3. Layout & components

**Request**: email field + Turnstile (Managed) + submit → always the same confirmation: "If an account exists for that email, we've sent a reset link" + resend note (rate limit disclosed vaguely).

**Reset**: new password + confirm, live strength meter (same rules as [TRD 13](13-create-account.md)), submit; invalid/expired-token state with a "request a new link" shortcut.

## 4. Data requirements

- Server action (request): Turnstile → rate limits (3/hr/email, 10/hr/IP — [security doc](../04-cross-cutting/security-and-bots.md)) → Medusa generates a **single-use token, 1h expiry, hashed at rest** → subscriber sends email T7 ([email-flows](../04-cross-cutting/email-flows.md)). Unknown email: identical response, no email sent.
- Server action (reset): validate token (single-use enforced), set password, **invalidate all existing sessions**, sign the user in, send an optional "your password was changed" notice.

## 5. Interactions & states

- Request success is identical for known/unknown emails (copy + timing).
- Expired/used/tampered token → same "link expired" state (indistinguishable), one-click re-request with email pre-filled when available.
- Success: auto sign-in → `/account` with "password updated" toast.
- Rate-limited request: still the neutral success message (silently dropped) — never confirm limits per-email to a prober.

## 6. SEO

`noindex, nofollow` on both routes. Titles `Reset Password | OdorElite`.

## 7. Analytics events

PostHog only (no marketing value, privacy-sensitive): `password_reset_requested` (no email), `password_reset_completed`, `password_reset_token_invalid`. No GA4/Meta events.

## 8. Acceptance criteria

- [ ] Known and unknown emails produce identical responses; only the known one receives T7.
- [ ] Token works once: second use of the same link shows the expired state.
- [ ] Token older than 1h rejected.
- [ ] Completing a reset invalidates the old session on a second device (verify with two browsers).
- [ ] 4th request for one email inside an hour sends nothing but still shows success.
- [ ] Weak new password blocked by the same policy as account creation.
