# Klaviyo

Marketing email: abandoned cart, welcome series, post-purchase, win-back, back-in-stock. Phase 3 — nothing blocks on this until the store has traffic. Flow triggers and content outlines are in [email-flows](../04-cross-cutting/email-flows.md).

## What it's for

Behavioral flows keyed off events the storefront/backend push to Klaviyo (Viewed Product, Added to Cart, Placed Order), plus newsletter campaigns to segments.

## Tier & cost

Free to 250 contacts / 500 sends per month; paid tiers scale by contact count (from ~$20/mo). Start free.

## Setup steps

1. Sign up at klaviyo.com → create the OdorElite account.
2. **Sending domain**: dedicated sending on `send.odorelite.com` (separate from Resend's `mail.` subdomain). Add the DKIM/SPF records Klaviyo lists into Cloudflare, DNS-only.
3. Create **Lists**: `Newsletter` (general opt-in), `Back in Stock`.
4. Create **Segments** (dynamic): `Engaged 90d`, `Purchasers`, `Lapsed 180d`, `High LTV (2+ orders)`.
5. Scaffold **Flows** (skeletons now, content in Phase 3): Welcome Series (trigger: joins Newsletter), Abandoned Cart (trigger: Added to Cart, no Placed Order in 4h), Post-Purchase (trigger: Placed Order), Win-back (trigger: no order in 120d), Back in Stock (trigger: subscribed to restock alert).
6. Event ingestion:
   - Server-side: Medusa subscriber pushes `Placed Order` (with line items, value) via the Klaviyo API — server events are the source of truth for revenue attribution.
   - Client-side: Klaviyo's `klaviyo.js` (loaded via the site id) tracks `Viewed Product` and identifies subscribers.
7. Newsletter signup form in the storefront footer posts to the Klaviyo Lists API (server action) with Turnstile verification ([security doc](../04-cross-cutting/security-and-bots.md)) — do not use the embedded Klaviyo form (bot magnet).

## Credentials to collect

| Env var | App | Where |
|---|---|---|
| `KLAVIYO_PRIVATE_API_KEY` | Medusa + storefront server actions | Settings → API Keys (private, `pk_…`) |
| `NEXT_PUBLIC_KLAVIYO_SITE_ID` | storefront | Settings → API Keys (public site id) |

## OdorElite-specific configuration

- **Consent**: only add contacts who explicitly opted in (checkout checkbox unticked by default in GDPR contexts — see [payments-and-compliance](../04-cross-cutting/payments-and-compliance.md)).
- Suppress transactional lookalikes: Klaviyo must never send order/shipping notifications — those are Resend's job; keeping the split clean protects deliverability of both.

## You're done when…

- A test `Placed Order` event from the Medusa dev backend appears on a Klaviyo profile with correct value and line items.
- The footer signup adds a profile to the `Newsletter` list and triggers the Welcome flow preview.
