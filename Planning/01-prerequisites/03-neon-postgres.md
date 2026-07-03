# Neon Postgres

Primary database for MedusaJS (products, orders, customers, carts). Local dev uses Docker Postgres; Neon serves preview and production.

## What it's for

Serverless Postgres with copy-on-write **branches** — one branch per environment, so preview deploys get an isolated copy of real-ish data without a second database bill.

## Tier & cost

- **Free** tier for setup and preview branches.
- **Launch (~$19/mo)** at production go-live: more compute, point-in-time restore, no cold-start pauses during business hours (set autosuspend ≥ 5 min or disable for the prod branch — Medusa keeps a connection pool).

## Setup steps

1. Sign up at neon.tech (GitHub SSO). Create project **odorelite**, region closest to the Medusa backend host, Postgres 16.
2. The default branch is `main` → this is **production**. Create two child branches:
   - `dev` — shared cloud dev/staging data.
   - `preview` — reset/re-branched freely; target of PR preview environments.
3. For each branch, copy the **pooled** connection string (the one with `-pooler` in the host). Medusa should use the pooled string; long-running migrations can use the direct string.
4. Optional but recommended: install the **Neon Vercel integration** so every Vercel preview deploy gets an automatic database branch.

## Credentials to collect

| Env var | App | Value |
|---|---|---|
| `DATABASE_URL` | Medusa | pooled connection string of the branch matching the environment, with `?sslmode=require` |

## OdorElite-specific configuration

- Run Medusa migrations (`medusa db:migrate`) against `dev` first, then `main` as part of the backend deploy pipeline — never auto-migrate prod from a laptop.
- Enable **point-in-time restore** on the prod branch once on the Launch plan; orders are the one dataset you cannot recreate.
- Weekly logical backup (`pg_dump`) to object storage via a scheduled GitHub Action, independent of Neon's own restore.

## You're done when…

- `psql "$DATABASE_URL" -c 'select 1'` succeeds for all three branches.
- Medusa boots against the `dev` branch and migrations have run (`medusa db:migrate` exits clean).
