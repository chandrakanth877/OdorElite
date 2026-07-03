# Security & Bot Protection

Fragrance e-commerce attracts card-testing bots, scalper/scraper bots, and credential stuffing. Defense is layered: **Cloudflare at the edge** ([setup](../01-prerequisites/07-cloudflare.md)) → **Turnstile on sensitive forms** → **Upstash rate limits in the app** ([setup](../01-prerequisites/13-upstash-redis.md)) → **Stripe Radar on payment**.

## Turnstile placement

| Form | Mode | Notes |
|---|---|---|
| Sign in | Managed, invisible-first | challenge escalates on repeated failures |
| Create account | Managed | blocks disposable-signup bots |
| Forgot password | Managed | prevents reset-email spam |
| Guest order lookup | Managed | prevents order-number enumeration |
| Newsletter signup | Invisible | list-bombing protection |
| Contact form | Managed | |
| Checkout | **None** | friction costs more than it saves; Radar + rate limits cover card testing |

Implementation: widget on the client (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`), token verified server-side via `siteverify` (`TURNSTILE_SECRET_KEY`) in the same server action that processes the form — a missing/failed token rejects the request before touching Medusa.

## Rate limits (application layer, `@upstash/ratelimit`, per IP unless noted)

| Endpoint / action | Limit | On exceed |
|---|---|---|
| Sign in | 5/min, 20/hr (also 10/hr per email) | 429 + generic error (no user enumeration) |
| Create account | 3/hr | 429 |
| Forgot password | 3/hr per email, 10/hr per IP | always respond "if the account exists, we sent a link" |
| Guest order lookup | 5/min | 429 + Turnstile re-challenge |
| Add to cart | 30/min | 429 (card-testing precursor behavior) |
| Payment session creation | 5/min per cart | 429 — primary card-testing chokepoint |
| Review submission | 3/day per customer | silent queue |
| Restock subscribe | 10/day per IP | 429 |

Cloudflare edge rules mirror the auth limits as a cheaper first layer; app limits are authoritative. Redis down ⇒ app limits fail open, edge limits remain.

## Auth hardening

- Medusa email/password auth: bcrypt/scrypt (built in); enforce password min 10 chars against a breached-password list check client-side (zxcvbn score ≥3).
- Session: httpOnly, `Secure`, `SameSite=Lax` cookies; JWT lifetime ≤ 7d with rotation on privilege-relevant changes (password change invalidates sessions).
- Sign-in errors are uniform ("invalid email or password") with identical timing (compare against dummy hash on unknown email).
- Password reset tokens: single-use, 1h expiry, hashed at rest (same pattern as `order_access_token` in the [data model](../02-architecture/data-model.md)).
- No account lockout (DoS vector) — rate limits + Turnstile escalate instead.

## Guest order-token security

Raw tokens only ever appear in emailed links; DB stores SHA-256. 90-day expiry. Status page reveals no full payment details (last-4 only) and masks the email. Details: [TRD 11](../03-pages/11-order-status-tracking.md).

## PCI scope

Card data never touches our servers: Stripe Payment Element (and Razorpay Checkout) render in Stripe/Razorpay-controlled iframes; we handle only tokens/intent ids. This keeps us at **SAQ A**. Requirements to preserve it:

- Never proxy or log Payment Element network calls; no card fields of our own, ever.
- Serve checkout over HTTPS only (everything is), no third-party scripts on `/checkout` beyond payment + analytics (audit list in the [checkout TRD](../03-pages/09-checkout.md)).
- CSP on checkout restricting `script-src` to self + Stripe/Razorpay + consented analytics domains.

## Headers & platform hygiene

- Global: `Strict-Transport-Security` (preload), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal; CSP report-only first, enforce after a clean week.
- Medusa admin (`/app`) reachable only via allow-listed IPs or Cloudflare Access.
- Dependency scanning (GitHub Dependabot + `pnpm audit` in CI); secrets only in Vercel/host env stores, never in the repo — `.env*` gitignored from day one.

## Monitoring

Sentry alert on: spikes in 429s (attack in progress), payment-session failures, webhook signature failures (someone probing endpoints). Review Cloudflare bot analytics weekly for the first month.
