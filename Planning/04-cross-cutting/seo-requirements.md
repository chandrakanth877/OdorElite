# SEO Requirements

Applies to every public page; each page TRD's SEO section references these rules rather than restating them.

## URL scheme

| Surface | Pattern | Notes |
|---|---|---|
| Home | `/` | |
| Category PLP | `/fragrances/{category}` | e.g. `/fragrances/men`, `/fragrances/unisex`; nested: `/fragrances/men/woody` |
| Brand index | `/brands` | |
| Brand page | `/brands/{brand-slug}` | |
| Product | `/products/{handle}` | handle = `{brand}-{name}-{concentration}`, e.g. `creed-aventus-edp`; flat, no category in path (products live in many categories) |
| Search | `/search?q=…` | **noindex** |
| Guides / blog | `/guides/{slug}`, `/blog/{slug}` | |
| Policies | `/policies/{shipping\|returns\|privacy\|terms}` | |
| Cart/checkout/order/account/auth | various | all **noindex, nofollow** via metadata |

Rules: lowercase, hyphenated slugs; no trailing slashes; slugs never change once published — renames get a 301 (maintain a redirect map in the storefront middleware).

## Canonicals

- Every page self-canonical with absolute `https://odorelite.com` URL.
- PLPs: filtered/sorted/paginated variations (`?notes=vanilla&sort=price_asc&page=2`) canonicalize to the clean category URL. Exception: curated filter landing pages we deliberately index (e.g. `/fragrances/men/woody`) are real routes, not query strings.
- One product = one URL. Variant selection (size) is client state, never a URL change.

## Metadata templates

| Page | `<title>` | Meta description |
|---|---|---|
| Home | `OdorElite — Designer & Niche Fragrances` | brand promise, ~155 chars |
| PLP | `{Category} Fragrances \| OdorElite` | template with count + top brands |
| Brand | `{Brand} Perfumes & Colognes \| OdorElite` | from `brand.description` |
| PDP | `{Brand} {Name} {Concentration} \| OdorElite` | first 155 chars of product description |
| Guide | `{Title} \| OdorElite Guides` | from Sanity SEO field |

Open Graph: every public page sets `og:title/description/image` (`t_og` Cloudinary transform for products) + `twitter:card=summary_large_image`.

## Structured data (JSON-LD)

| Page | Types |
|---|---|
| All | `Organization` (home only) + `BreadcrumbList` everywhere breadcrumbs render |
| PDP | `Product` with `brand`, `offers` (price, currency, availability, url), `aggregateRating` + `review` (only when approved reviews exist — never fake) |
| Brand | `Brand` |
| Guides | `Article` |
| Search | `WebSite` + `SearchAction` (sitelinks searchbox, on home) |

Validate with Google's Rich Results test as part of PDP acceptance.

## Sitemaps & robots

- `app/sitemap.ts` generates a sitemap index: `sitemap-products.xml` (from Medusa, `lastmod` = product `updated_at`), `sitemap-categories.xml`, `sitemap-brands.xml`, `sitemap-content.xml` (from Sanity). Regenerated per request with ISR (1h).
- `robots.txt`: allow all; `Disallow: /cart /checkout /account /order /api /search`; `Sitemap:` line. Preview deployments send `X-Robots-Tag: noindex` globally (Vercel deployment protection covers this too).
- Submit the sitemap in Search Console ([12-analytics](../01-prerequisites/12-analytics.md)).

## Performance budgets (Core Web Vitals are ranking inputs)

- LCP < 2.5s on PDP/PLP (hero/product image via Cloudinary `f_auto,q_auto`, `priority` on the LCP image, correct `sizes`).
- CLS < 0.1: fixed aspect-ratio boxes for all images; no layout-shifting banners.
- INP < 200ms: filters and cart updates use optimistic UI.

## Fragrance-specific SEO plays

- Note/family landing pages (`/fragrances/notes/vanilla`) are high-intent long-tail — Phase 3, generated from the `note` table with editorial intros.
- Guides interlink to PDPs (product reference blocks in Sanity) — the internal-linking engine for new products.
