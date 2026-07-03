# Analytics & Monitoring

Five tools, one setup doc. *What* gets tracked (the event dictionary) is in the [analytics tracking plan](../02-architecture/analytics-tracking-plan.md); this doc is accounts and keys. All client-side trackers load **only after cookie consent** where required — see [payments-and-compliance](../04-cross-cutting/payments-and-compliance.md).

## GA4 (Phase 2)

1. analytics.google.com → create property **OdorElite**, web data stream for `odorelite.com` → copy the Measurement ID (`G-…`).
2. Mark as key events (conversions): `purchase`, `add_to_cart`, `begin_checkout`, `sign_up`.
3. Enable enhanced measurement, but disable its automatic "site search" (we fire our own `search` event with better params).
4. Link Search Console (below) under Admin → Product links.

| Env var | App |
|---|---|
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | storefront |

## Google Search Console (Phase 2)

1. search.google.com/search-console → add **Domain** property `odorelite.com` → verify via the DNS TXT record in Cloudflare.
2. Submit `https://odorelite.com/sitemap.xml` once live ([SEO doc](../04-cross-cutting/seo-requirements.md)).

No env vars.

## Meta Pixel + Conversions API (Phase 3)

1. business.facebook.com → Events Manager → create Pixel **OdorElite** → copy Pixel ID.
2. Generate a **Conversions API access token** from the pixel's settings.
3. Client fires standard events (`ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`); the Medusa backend mirrors `Purchase` server-side via CAPI with the same `event_id` for deduplication — mapping in the [tracking plan](../02-architecture/analytics-tracking-plan.md).

| Env var | App |
|---|---|
| `NEXT_PUBLIC_META_PIXEL_ID` | storefront |
| `META_CAPI_ACCESS_TOKEN` | Medusa |

## PostHog (Phase 3)

1. posthog.com (US cloud) → create project **odorelite** → copy the project API key.
2. Use for funnels (PLP → PDP → cart → purchase), session replay (mask all inputs — Settings → Replay → mask text/inputs on `/checkout` and `/account`), and feature flags for merchandising experiments.

| Env var | App |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | storefront |
| `NEXT_PUBLIC_POSTHOG_HOST` | storefront (`https://us.i.posthog.com`) |

## Sentry (Phase 2)

1. sentry.io → create org + two projects: `odorelite-storefront` (Next.js) and `odorelite-medusa` (Node).
2. Install via `@sentry/nextjs` wizard (storefront) and `@sentry/node` (backend). Upload source maps from CI using an auth token.
3. Alert rule: any error on `/checkout` or payment webhooks → immediate email/Slack; everything else daily digest.

| Env var | App |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | storefront |
| `SENTRY_DSN` | Medusa |
| `SENTRY_AUTH_TOKEN` | CI only (source maps) |

## You're done when…

- GA4 DebugView shows `page_view` and `view_item` from a dev session.
- Search Console verifies the domain.
- A thrown test error in each app appears in the right Sentry project with a readable stack trace.
- (Phase 3) Meta Events Manager test events tool shows browser + server `Purchase` deduplicated; PostHog shows a session replay with masked checkout inputs.
