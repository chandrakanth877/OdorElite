# TRD 07 — Content Pages (Guides, Blog, Policies)

## 1. Purpose & success metric

Editorial content (fragrance guides, blog) drives organic acquisition and feeds internal links to PDPs; policy pages satisfy legal requirements and buyer-trust checks. **KPI (guides): organic entrances and guide → PDP CTR. KPI (policies): existence and findability (support-ticket deflection).**

## 2. Route & rendering

- Routes: `/guides` (index), `/guides/[slug]`, `/blog` (index), `/blog/[slug]`, `/policies/[slug]` (`shipping`, `returns`, `privacy`, `terms`).
- All ISR with on-demand revalidation from the Sanity publish webhook ([integration map](../02-architecture/integration-map.md)).

## 3. Layout & components

**Guide/blog article** (`guide`, `post` documents):

| Section | Component | Notes |
|---|---|---|
| Breadcrumbs + header | `ArticleHeader` | H1, author, date, hero (Sanity CDN) |
| Body | `PortableTextRenderer` | headings, images, pull quotes, and the **inline `ProductReferenceCard`** — a product card block resolved live against Medusa by handle (current price/stock, add-to-cart, wishlist) |
| Related products | `ProductRail id=rec_guide` | union of products referenced in the body |
| Related articles | `GuideCards` | same category |
| Newsletter CTA | `NewsletterForm` | mid-funnel capture |

**Guide/blog index**: card grid, category filter tabs, pagination.

**Policy page** (`policyPage`): plain prose layout, table of contents for long docs, "last updated" date. Content requirements per policy are specified in [payments-and-compliance](../04-cross-cutting/payments-and-compliance.md) (including the fragrance shipping-restrictions note).

## 4. Data requirements

- Sanity GROQ per route (published content from CDN, drafts with `SANITY_API_READ_TOKEN` in preview mode), tags `content:guide:{slug}` etc.
- Medusa: resolve product references in article bodies server-side (price/stock accurate at render; revalidated with the product's tag too — a guide referencing a product revalidates when that product changes).

## 5. Interactions & states

- Product cards inside articles: add-to-cart/wishlist behave exactly as PLP cards; out-of-stock reference renders with notify-me instead of disappearing (dead recommendations erode trust).
- Draft preview: `/api/draft?secret=…` enables Next.js draft mode for editors.
- Unknown slug → 404; unpublishing → revalidate → 404 (and the slug drops from the sitemap).
- Policy pages must render fine with zero JS (legal accessibility).

## 6. SEO

Guides/blog: title from Sanity SEO fields; JSON-LD `Article` + `BreadcrumbList`; self-canonical; `sitemap-content.xml`. Policies: indexable (buyers google "odorelite returns"), plain titles, no structured data needed. Rules: [seo-requirements](../04-cross-cutting/seo-requirements.md).

## 7. Analytics events

`page_view` (with `content_type`, `content_slug`); `select_item`/`add_to_cart` (`source: guide_embed`) on embedded product cards; `view_item_list` for the related rail (`item_list_id: rec_guide`); `newsletter_signup` (`location: article`); PostHog scroll-depth on guides.

## 8. Acceptance criteria

- [ ] Publishing a guide in the Studio makes it live within 60s, listed on `/guides`, and present in the sitemap.
- [ ] Embedded product card shows live price and adds to cart; discontinuing that product doesn't break the article.
- [ ] All four policy pages render, are linked in the footer, and readable without JS.
- [ ] Draft mode shows unpublished edits to editors only.
- [ ] `Article` rich-results test passes on a guide.
