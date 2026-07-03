# Upstash Redis

Serverless Redis reachable over REST — usable from Vercel serverless/edge functions where a TCP Redis client is awkward. Local dev uses Docker Redis; Upstash serves preview/production.

## What it's for

- **Guest cart session mapping**: `cart:{session-cookie-id} → medusa_cart_id` with a 30-day TTL, so anonymous visitors keep their cart across visits without a Medusa customer record ([cart TRD](../03-pages/08-cart.md)).
- **Application-layer rate limiting** via `@upstash/ratelimit`: sign-in attempts, password-reset requests, guest order lookups — the second layer behind Cloudflare's edge rules ([security doc](../04-cross-cutting/security-and-bots.md)).
- **Wishlist for guests**: `wishlist:{session-id} → set of product ids`, merged into the customer record on sign-in ([wishlist TRD](../03-pages/19-wishlist.md)).
- Medusa's own event bus / workflow engine uses its `REDIS_URL` (Docker locally; on the backend host use its managed Redis or Upstash's TCP endpoint).

## Tier & cost

**Pay-as-you-go free tier**: 10k commands/day free, then $0.2 per 100k — effectively $0 until real traffic.

## Setup steps

1. Sign up at upstash.com → Create database **odorelite**, region matching the Vercel function region, TLS on.
2. Copy the **REST URL** and **REST token** from the database page (the REST credentials, not the TCP ones, are what the storefront uses).
3. Storefront: install `@upstash/redis` + `@upstash/ratelimit`; create a shared `lib/redis.ts` client.
4. Create a second database **odorelite-preview** for the preview environment (rate-limit counters and carts must not leak between environments).

## Credentials to collect

| Env var | App | Where |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | storefront (server) | database page |
| `UPSTASH_REDIS_REST_TOKEN` | storefront (server) | database page |
| `REDIS_URL` | Medusa | Docker locally; managed Redis in prod |

## Key conventions

```
cart:{sessionId}            → cartId            TTL 30d
wishlist:{sessionId}        → SET<productId>    TTL 90d
rl:signin:{ip}              → rate-limit window (managed by @upstash/ratelimit)
rl:orderlookup:{ip}         → rate-limit window
restock:{productId}         → SET<email>        (back-in-stock subscriptions before Klaviyo handoff)
```

## You're done when…

- `curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" $UPSTASH_REDIS_REST_URL/set/ping/pong` then `…/get/ping` round-trips.
- A rate-limit smoke test (6th sign-in attempt within a minute from one IP) returns the limited response.
