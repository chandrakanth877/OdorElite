# Local Development Setup

What to install and scaffold before any feature work. No third-party accounts needed for this doc except GitHub (for cloning).

## Toolchain

| Tool | Version | Install |
|---|---|---|
| Node.js | 20 LTS or later | `nvm install 20 && nvm use 20` (pin with `.nvmrc`) |
| pnpm | 9+ | `corepack enable && corepack prepare pnpm@latest --activate` |
| Docker Desktop | current | docker.com — runs local Postgres + Redis so dev doesn't depend on Neon/Upstash |
| Medusa CLI | latest | `pnpm dlx create-medusa-app@latest` handles this; no global install needed |
| Stripe CLI | latest | For webhook forwarding in dev — `brew install stripe/stripe-cli/stripe` |

## Repository layout (monorepo)

```
odorelite/
├── apps/
│   ├── storefront/        # Next.js App Router
│   └── medusa/            # MedusaJS v2 backend + admin
├── packages/
│   └── emails/            # React Email templates (used by Medusa subscribers via Resend)
├── Planning/              # this documentation set
├── pnpm-workspace.yaml
└── .nvmrc
```

## Scaffold steps

1. **Medusa backend**: `pnpm dlx create-medusa-app@latest apps/medusa` — choose Postgres, seed with sample data initially. This also installs the admin dashboard at `/app`.
2. **Next.js storefront**: start from the official Medusa Next.js Starter (`https://github.com/medusajs/nextjs-starter-medusa`) into `apps/storefront` rather than a bare `create-next-app` — it ships cart, checkout, and account flows wired to Medusa that the page TRDs then customize.
3. **Local services** via `docker-compose.yml` at the repo root: `postgres:16` (port 5432) and `redis:7` (port 6379). Dev uses these; preview/prod use Neon and Upstash.

## Environment files

Two apps, two files. Commit `.env.example` for each with names only.

**`apps/medusa/.env`**

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/odorelite
REDIS_URL=redis://localhost:6379
JWT_SECRET=            # openssl rand -base64 32
COOKIE_SECRET=         # openssl rand -base64 32
STORE_CORS=http://localhost:3000
ADMIN_CORS=http://localhost:9000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
ALGOLIA_ADMIN_API_KEY=
RESEND_API_KEY=
KLAVIYO_PRIVATE_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SENTRY_DSN=
```

**`apps/storefront/.env.local`**

```
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=   # from Medusa admin → Settings → Publishable API Keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_ALGOLIA_APP_ID=
NEXT_PUBLIC_ALGOLIA_SEARCH_API_KEY=
NEXT_PUBLIC_SANITY_PROJECT_ID=
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_READ_TOKEN=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_GA4_MEASUREMENT_ID=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_SENTRY_DSN=
```

## Daily dev loop

```bash
docker compose up -d                 # postgres + redis
pnpm --filter medusa dev             # backend on :9000, admin on :9000/app
pnpm --filter storefront dev         # storefront on :3000
stripe listen --forward-to localhost:9000/hooks/payment/stripe   # when testing payments
```

## You're done when…

- `localhost:9000/app` shows the Medusa admin and you can log in.
- `localhost:3000` renders the starter storefront listing seeded products.
- `.env.example` exists in both apps and matches the tables above.
