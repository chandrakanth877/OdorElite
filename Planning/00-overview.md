# OdorElite — Planning Overview

OdorElite is a perfume e-commerce store. This folder is the complete pre-code planning set: what accounts to open, how the system fits together, and a technical requirement document (TRD) for every page. The docs are written to be executed in order — set up prerequisites first, then build pages phase by phase per the [roadmap](05-roadmap.md).

## Tech stack (decision record)

| Concern | Choice | Why |
|---|---|---|
| Storefront | Next.js (App Router) on Vercel | ISR for catalog pages, React Server Components, first-class Vercel deploys |
| Commerce backend | MedusaJS v2 | Open-source, Node-based, ownable data, plugin ecosystem (Stripe, Algolia) |
| Database | Neon Postgres | Serverless Postgres with branch-per-environment (dev/preview/prod) |
| Payments | Stripe (primary) | Payment Element, saved cards via SetupIntents, Radar fraud protection |
| Payments (optional) | Razorpay | India market: UPI, netbanking, local cards — documented as an addendum |
| Search | Algolia | InstantSearch UI, typo tolerance, synonyms (critical for fragrance terms), Recommend |
| CDN / DNS / bots | Cloudflare | WAF, Bot Fight Mode, Turnstile CAPTCHA, edge rate limiting |
| Transactional email | Resend | Simple API, React Email templates, good deliverability on `mail.odorelite.com` |
| Marketing email | Klaviyo | E-commerce flows (abandoned cart, win-back), segmentation |
| CMS | Sanity | Structured content for guides/blog/policy pages, GROQ queries, portable text |
| Media | Cloudinary | Product image transforms, f_auto/q_auto delivery |
| Sessions / rate limits | Upstash Redis | Serverless Redis for guest cart sessions and rate-limit counters |
| Analytics | GA4, Meta Pixel + CAPI, PostHog, Sentry, Search Console | See [tracking plan](02-architecture/analytics-tracking-plan.md) |
| Hosting / CI | GitHub + Vercel | Preview deploys per PR |

## Open decisions

| # | Decision | Default taken in these docs | Revisit when |
|---|---|---|---|
| 1 | **Target market / payment gateway.** Stripe does not support UPI; Razorpay is the standard for India. | Stripe is primary throughout; Razorpay is documented in [05-razorpay-addendum](01-prerequisites/05-razorpay-addendum.md) and referenced where flows differ. | Before building checkout ([03-pages/09-checkout.md](03-pages/09-checkout.md)). If India-first, swap the primary gateway and treat Stripe as the international fallback. |
| 2 | Currency & shipping zones | Single currency (USD), single shipping zone | Follows from decision 1 |
| 3 | Blog vs. guides-only content | Both modeled in Sanity; guides prioritized | Phase 2 content planning |

## Document index

### 01 — Prerequisites (accounts & setup)

Start with the [master accounts checklist](01-prerequisites/00-accounts-checklist.md), which orders everything by phase.

| Doc | Service |
|---|---|
| [00-accounts-checklist](01-prerequisites/00-accounts-checklist.md) | Master checklist: every account, tier, cost, env vars, priority |
| [01-local-dev-setup](01-prerequisites/01-local-dev-setup.md) | Node, pnpm, Docker, Medusa CLI, Next.js scaffold, env files |
| [02-github-vercel](01-prerequisites/02-github-vercel.md) | Repo, CI/CD, Vercel project, preview deploys |
| [03-neon-postgres](01-prerequisites/03-neon-postgres.md) | Database project, environment branches, connection strings |
| [04-stripe](01-prerequisites/04-stripe.md) | Keys, webhooks, Payment Element, Radar, SetupIntents |
| [05-razorpay-addendum](01-prerequisites/05-razorpay-addendum.md) | Optional India gateway: KYC, UPI, webhooks |
| [06-algolia](01-prerequisites/06-algolia.md) | App, indices, keys, synonyms, InstantSearch, Recommend |
| [07-cloudflare](01-prerequisites/07-cloudflare.md) | DNS, WAF, Bot Fight Mode, Turnstile, rate limiting |
| [08-resend](01-prerequisites/08-resend.md) | Sending-domain verification (SPF/DKIM/DMARC), API key |
| [09-klaviyo](01-prerequisites/09-klaviyo.md) | Lists/segments, flow skeletons, API keys |
| [10-sanity](01-prerequisites/10-sanity.md) | Project, dataset, schemas, CORS, tokens |
| [11-cloudinary](01-prerequisites/11-cloudinary.md) | Upload presets, folder conventions |
| [12-analytics](01-prerequisites/12-analytics.md) | GA4, Search Console, Meta Pixel + CAPI, PostHog, Sentry |
| [13-upstash-redis](01-prerequisites/13-upstash-redis.md) | Database, REST credentials, cart-session usage |

### 02 — Architecture

| Doc | Covers |
|---|---|
| [system-architecture](02-architecture/system-architecture.md) | Component diagram, rendering strategy, request flows |
| [data-model](02-architecture/data-model.md) | Schema incl. fragrance-specific tables (notes, families, concentrations, reviews) |
| [integration-map](02-architecture/integration-map.md) | Webhooks and event fan-out between all services |
| [analytics-tracking-plan](02-architecture/analytics-tracking-plan.md) | Canonical event dictionary |

### 03 — Page TRDs

Every page doc follows the same template: purpose & KPI → route & rendering → layout & components → data requirements → interactions & states → SEO → analytics events → acceptance criteria.

| Doc | Page |
|---|---|
| [01-home](03-pages/01-home.md) | Home |
| [02-category-plp](03-pages/02-category-plp.md) | Category / product listing |
| [03-brand-index](03-pages/03-brand-index.md) | All brands (A–Z) |
| [04-brand-page](03-pages/04-brand-page.md) | Single brand |
| [05-search-results](03-pages/05-search-results.md) | Search results |
| [06-product-detail](03-pages/06-product-detail.md) | Product detail (PDP), incl. reviews |
| [07-content-pages](03-pages/07-content-pages.md) | Guides/blog + policy pages |
| [08-cart](03-pages/08-cart.md) | Cart |
| [09-checkout](03-pages/09-checkout.md) | Checkout, incl. guest checkout |
| [10-order-confirmation](03-pages/10-order-confirmation.md) | Order placed |
| [11-order-status-tracking](03-pages/11-order-status-tracking.md) | Order status, incl. tokenized guest access |
| [12-sign-in](03-pages/12-sign-in.md) | Sign in |
| [13-create-account](03-pages/13-create-account.md) | Create account |
| [14-forgot-password](03-pages/14-forgot-password.md) | Forgot / reset password |
| [15-account-overview](03-pages/15-account-overview.md) | Account dashboard |
| [16-order-history](03-pages/16-order-history.md) | Order history list + detail |
| [17-saved-cards](03-pages/17-saved-cards.md) | Saved cards (Stripe SetupIntent) |
| [18-addresses](03-pages/18-addresses.md) | Address book |
| [19-wishlist](03-pages/19-wishlist.md) | Wishlist, incl. guest + merge on sign-in |

### 04 — Cross-cutting requirements

| Doc | Covers |
|---|---|
| [seo-requirements](04-cross-cutting/seo-requirements.md) | URL scheme, canonicals, structured data, sitemaps, robots.txt |
| [search-and-recommendations](04-cross-cutting/search-and-recommendations.md) | Index schema, synonyms, per-surface recommendation logic |
| [email-flows](04-cross-cutting/email-flows.md) | Every transactional + marketing email: trigger, template, service |
| [security-and-bots](04-cross-cutting/security-and-bots.md) | Turnstile placement, rate limits, auth hardening, PCI scope |
| [payments-and-compliance](04-cross-cutting/payments-and-compliance.md) | Payment flows, webhook idempotency, GDPR/consent, legal pages |

### 05 — Roadmap

[05-roadmap.md](05-roadmap.md) — three phases with acceptance gates, each mapped to the docs above.

## Conventions used across all docs

- **Env vars** are named consistently and collected in the [accounts checklist](01-prerequisites/00-accounts-checklist.md); copy them into `.env.example` when scaffolding. `NEXT_PUBLIC_*` vars are browser-exposed; everything else is server-only.
- **Two apps, two env files**: the Next.js storefront (`apps/storefront/.env.local`) and the Medusa backend (`apps/medusa/.env`). Each prerequisite doc says which app a variable belongs to.
- Relative links between docs; mermaid for diagrams.
