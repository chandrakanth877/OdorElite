# GitHub + Vercel

Source control, CI, and storefront hosting. The Medusa backend is **not** hosted on Vercel (it's a long-running Node server) — host it on Railway/Render/Fly; this doc covers the storefront side and CI for both apps.

## What it's for

- GitHub: monorepo, PR review flow, GitHub Actions for backend deploy + checks.
- Vercel: builds and hosts `apps/storefront`, one preview deploy per PR, holds storefront env vars per environment.

## Tier & cost

- GitHub Free (private repo included).
- Vercel Hobby ($0) for development; upgrade to **Pro ($20/mo)** before launch — Hobby prohibits commercial use.

## Setup steps

1. Create the GitHub repo `odorelite`, default branch `main`, branch protection on `main` (require PR + passing checks).
2. Sign up at vercel.com **with the GitHub account** (keeps the integration trivial).
3. Vercel → Add New Project → import the repo. Set **Root Directory** to `apps/storefront`, framework preset Next.js, install command `pnpm install`.
4. Add environment variables (Project → Settings → Environment Variables). Everything from `apps/storefront/.env.local` in [01-local-dev-setup](01-local-dev-setup.md), scoped per environment:
   - **Production**: live keys, `NEXT_PUBLIC_MEDUSA_BACKEND_URL` = prod backend URL.
   - **Preview**: test keys, backend staging URL, Neon preview branch (see [03-neon-postgres](03-neon-postgres.md)).
5. GitHub Actions workflow for the backend: lint + typecheck + `medusa build` on PR; deploy to the backend host on merge to `main`.
6. Add the custom domain `odorelite.com` to the Vercel project **after** Cloudflare DNS is set up ([07-cloudflare](07-cloudflare.md)) — CNAME `odorelite.com`/`www` → `cname.vercel-dns.com`, proxy mode per the Cloudflare doc.

## Credentials to collect

| Value | Where it goes |
|---|---|
| — | No env vars of its own; Vercel is the *store* for all storefront vars |
| `VERCEL_TOKEN` (only if scripting deploys from Actions) | GitHub repo secrets |

## OdorElite-specific configuration

- Enable Vercel **Skew Protection** and **Deployment Protection** for previews (previews shouldn't be indexable or public).
- Set `ISR`/image optimization region close to the Medusa backend region to keep revalidation fast.
- Turn on Vercel Analytics only if not using GA4 for web vitals; otherwise skip to avoid double-paying.

## You're done when…

- Opening a PR produces a preview URL that renders the storefront against test-mode services.
- Merging to `main` deploys production automatically, and `main` cannot be pushed to directly.
