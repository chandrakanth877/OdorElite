# Cloudflare

DNS, WAF, bot protection, and Turnstile CAPTCHA. The policy for *where* bot controls apply is in [security-and-bots](../04-cross-cutting/security-and-bots.md); this doc is account setup.

## What it's for

- Authoritative DNS for `odorelite.com`.
- WAF + **Bot Fight Mode** in front of the storefront and backend (fragrance stores attract scalper/scraper bots).
- **Turnstile** (free CAPTCHA) on auth forms, guest order lookup, and checkout-abuse points.
- Edge **rate limiting** on auth and cart endpoints as the first layer (application-layer limits via Upstash are the second — see [13-upstash-redis](13-upstash-redis.md)).

## Tier & cost

- **Free** plan covers DNS, basic WAF managed rules, Bot Fight Mode, Turnstile, and 1 rate-limiting rule.
- **Pro ($25/mo)** at launch: better WAF managed rulesets, more rate-limit rules, Super Bot Fight Mode.

## Setup steps

1. Sign up at cloudflare.com → Add site `odorelite.com` → change nameservers at the registrar to the two Cloudflare gives you.
2. DNS records:
   - `odorelite.com`, `www` → CNAME `cname.vercel-dns.com` — **DNS-only (grey cloud)**; Vercel needs to terminate TLS for its own cert issuance, and double-proxying causes redirect loops. Revisit proxying later only with the documented Vercel/Cloudflare settings.
   - `api.odorelite.com` → backend host — **proxied (orange cloud)** so WAF/bot rules cover the Medusa API.
   - `mail.odorelite.com` TXT/CNAME records per [08-resend](08-resend.md).
3. SSL/TLS mode: **Full (strict)**.
4. Security → Bots → enable **Bot Fight Mode**.
5. WAF → enable Cloudflare Managed Ruleset; add a custom rule blocking non-browser user agents on `/checkout*` and `/account*` paths of the API host.
6. Rate limiting rule (the free one): `api.odorelite.com/auth/*` — 10 requests/min per IP → block 10 min.
7. Turnstile → Add widget **odorelite-auth** (Managed mode), domains `odorelite.com` + preview domains. Collect the site key and secret.

## Credentials to collect

| Env var | App | Where |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | storefront | Turnstile widget settings |
| `TURNSTILE_SECRET_KEY` | storefront (server actions) + Medusa | same |

## You're done when…

- `dig odorelite.com NS` returns Cloudflare nameservers; the site loads over HTTPS.
- The Turnstile demo widget renders on a test page and server-side `siteverify` returns `success: true`.
- Hitting the rate-limited auth path 11× in a minute returns a 429.
