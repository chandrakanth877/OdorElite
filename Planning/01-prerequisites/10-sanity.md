# Sanity

CMS for editorial content: fragrance guides, blog posts, policy pages, and homepage editorial slots. Product data stays in Medusa; Sanity holds only content. Page behavior is specified in the [content-pages TRD](../03-pages/07-content-pages.md).

## What it's for

Structured content with a hosted editing Studio, GROQ queries from the storefront, and webhooks that trigger Next.js ISR revalidation on publish.

## Tier & cost

**Free** plan: 2 non-admin users, 10GB bandwidth — enough well past launch. Growth ($15/user/mo) only when an editorial team exists.

## Setup steps

1. `pnpm dlx sanity@latest init` inside `apps/studio` (a third workspace in the monorepo) → creates the project + `production` dataset. Sign in with the shared ops account.
2. Define schemas (versioned in the repo):
   - `guide` — title, slug, hero image, portable text body, related product handles, SEO fields.
   - `post` — blog post; same shape, different taxonomy.
   - `policyPage` — title, slug, body (shipping, returns, privacy, terms).
   - `homepageEditorial` — curated slots for the [home page](../03-pages/01-home.md): hero, featured collections, guide picks.
   - `author`, `category` — supporting.
3. Deploy the Studio (`sanity deploy` → `odorelite.sanity.studio`) — editors never need local tooling.
4. CORS: Manage → API → add `http://localhost:3000`, the Vercel preview wildcard, and `https://odorelite.com`.
5. Create a **read token** (Viewer role) for the storefront's server-side GROQ fetches on draft/preview content; published content is fetched from the public CDN endpoint with no token.
6. Webhook: Manage → API → Webhooks → on publish of `guide|post|policyPage|homepageEditorial` → `POST https://odorelite.com/api/revalidate?secret=…` (Next.js route calls `revalidateTag`).

## Credentials to collect

| Env var | App | Where |
|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | storefront | sanity.io/manage |
| `NEXT_PUBLIC_SANITY_DATASET` | storefront | `production` |
| `SANITY_API_READ_TOKEN` | storefront (server) | Manage → API → Tokens |

## OdorElite-specific configuration

- Portable text must support an inline **product reference block** (renders a product card inside guide bodies — the guide→PDP funnel is the main content KPI).
- Image pipeline: Sanity's CDN is fine for editorial images; product imagery stays in Cloudinary ([11-cloudinary](11-cloudinary.md)).

## You're done when…

- The Studio loads at the deployed URL and an editor can publish a test guide.
- Publishing that guide makes it appear on the storefront within seconds (revalidation webhook verified in Vercel logs).
