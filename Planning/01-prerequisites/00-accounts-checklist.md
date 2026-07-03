# Accounts Checklist

Master list of every third-party account OdorElite needs. Work top-to-bottom within your current phase (phases defined in the [roadmap](../05-roadmap.md)). Each row links to a setup doc that ends with a "you're done when…" verification step.

## Phase 1 — required before the first line of checkout code

| Service | Purpose | Tier to pick | Cost | Key env vars | Setup doc |
|---|---|---|---|---|---|
| GitHub | Repo + CI | Free | $0 | — | [02-github-vercel](02-github-vercel.md) |
| Vercel | Storefront hosting, preview deploys | Hobby → Pro at launch | $0 → $20/mo | (holds all storefront vars) | [02-github-vercel](02-github-vercel.md) |
| Neon | Postgres for Medusa | Free → Launch at prod | $0 → ~$19/mo | `DATABASE_URL` | [03-neon-postgres](03-neon-postgres.md) |
| Stripe | Payments | Standard (pay-per-txn) | 2.9% + 30¢/txn | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | [04-stripe](04-stripe.md) |
| Resend | Transactional email | Free (3k/mo) → Pro | $0 → $20/mo | `RESEND_API_KEY` | [08-resend](08-resend.md) |
| Cloudinary | Product images | Free (25 credits) | $0 to start | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | [11-cloudinary](11-cloudinary.md) |
| Upstash | Redis (cart sessions, rate limits) | Free (pay-as-you-go) | $0 to start | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | [13-upstash-redis](13-upstash-redis.md) |

Also required in Phase 1, no account signup: [local dev setup](01-local-dev-setup.md) (Node 20+, pnpm, Docker, Medusa CLI).

## Phase 2 — before search, content, and accounts features

| Service | Purpose | Tier to pick | Cost | Key env vars | Setup doc |
|---|---|---|---|---|---|
| Algolia | Search + recommendations | Build (free 10k rec/mo) → Grow | $0 → usage-based | `NEXT_PUBLIC_ALGOLIA_APP_ID`, `NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY`, `ALGOLIA_ADMIN_API_KEY` | [06-algolia](06-algolia.md) |
| Sanity | CMS for guides/policies | Free → Growth | $0 → $15/user/mo | `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_READ_TOKEN` | [10-sanity](10-sanity.md) |
| Cloudflare | DNS, WAF, Turnstile, rate limiting | Free (Pro at launch for WAF rules) | $0 → $25/mo | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | [07-cloudflare](07-cloudflare.md) |
| Google (GA4 + Search Console) | Analytics, SEO monitoring | Free | $0 | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | [12-analytics](12-analytics.md) |
| Sentry | Error monitoring | Developer (free) → Team | $0 → $26/mo | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | [12-analytics](12-analytics.md) |

## Phase 3 — growth & marketing

| Service | Purpose | Tier to pick | Cost | Key env vars | Setup doc |
|---|---|---|---|---|---|
| Klaviyo | Marketing email flows | Free (<250 contacts) → paid | $0 → from $20/mo | `KLAVIYO_PRIVATE_API_KEY`, `NEXT_PUBLIC_KLAVIYO_SITE_ID` | [09-klaviyo](09-klaviyo.md) |
| Meta Business | Pixel + Conversions API | Free (ads paid) | $0 | `NEXT_PUBLIC_META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN` | [12-analytics](12-analytics.md) |
| PostHog | Product analytics, funnels, session replay | Free tier | $0 to start | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | [12-analytics](12-analytics.md) |
| Razorpay *(optional — open decision #1)* | India/UPI payments | Standard | 2% domestic/txn | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | [05-razorpay-addendum](05-razorpay-addendum.md) |

## Backend-only secrets (generated, not from a service)

| Env var | App | Purpose |
|---|---|---|
| `JWT_SECRET` | Medusa | Auth token signing — `openssl rand -base64 32` |
| `COOKIE_SECRET` | Medusa | Session cookie signing — `openssl rand -base64 32` |
| `MEDUSA_BACKEND_URL` / `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | both | Backend URL (localhost:9000 in dev) |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | storefront | Created in Medusa admin after first boot |

## Practical notes

- Use a single shared email alias (e.g. `ops@odorelite.com`) as the account owner everywhere, not a personal address.
- Enable 2FA on GitHub, Vercel, Stripe, Cloudflare, and Neon on day one — these are the accounts that can lose you money or data.
- Every service has a test/sandbox mode or free tier; nothing here requires payment until launch except possibly the domain itself.
- As you complete each setup doc, paste the collected vars into `.env.example` (names only, no values) so the scaffold stays in sync.
