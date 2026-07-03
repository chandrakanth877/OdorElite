# TRD 04 — Brand Page

## 1. Purpose & success metric

All products from one brand plus brand story — the landing page for "brand + perfume" queries, one of the highest-intent organic patterns. **KPI: organic entrances per brand page and brand-page → PDP CTR.**

## 2. Route & rendering

- Route: `/brands/[slug]` (e.g. `/brands/creed`)
- ISR, revalidate 1h + on-demand on brand update or any of the brand's product events.
- `generateStaticParams` pre-builds all brands at deploy; new brands render on-demand.

## 3. Layout & components

| Section | Component | Notes |
|---|---|---|
| Breadcrumbs | `Breadcrumbs` | Home → Brands → {Brand} |
| Brand header | `BrandHero` | logo (`brands/{slug}/logo.png`), H1 `{Brand} Perfumes & Colognes`, country + founded year, 2–3 paragraph `brand.description` (collapsible on mobile) |
| Product grid | reuses PLP `ProductCard[]` + `FilterPanel` scoped to the brand | facets: family, notes, concentration, price; sort options identical to [TRD 02](02-category-plp.md) |
| Bestsellers strip | `ProductRail id=rec_brand_top` | top 4 by `popularity_score` within brand — above the grid on mobile |
| Related guides | `GuideCards` | Sanity guides referencing this brand (optional; hidden when none) |

## 4. Data requirements

- Medusa/brand module: brand record by slug (server, tag `brand:{slug}`); 404 when missing.
- Algolia: grid via InstantSearch with fixed filter `brand_slug:{slug}` (initial page server-fetched for SEO, as on PLP).
- Sanity: guides where `relatedBrands` includes the slug.

## 5. Interactions & states

- Identical filter/sort/quick-add/wishlist behavior to [TRD 02](02-category-plp.md) — same components, brand filter pinned and not removable.
- Brand with all products out of stock: grid renders with "Notify me" cards; header unchanged.
- Unknown slug → 404 with brand-index link; renamed slug → 301 via redirect map.

## 6. SEO

Title `{Brand} Perfumes & Colognes | OdorElite`; description from `brand.description`; JSON-LD `Brand` + `BreadcrumbList`; self-canonical; in `sitemap-brands.xml`; brand description is real crawlable text (not truncated server-side — collapse is CSS/client only). Rules: [seo-requirements](../04-cross-cutting/seo-requirements.md).

## 7. Analytics events

`page_view` (with `brand` param); `view_item_list` (`item_list_id: brand_{slug}`); `select_item`; `add_to_cart` (`source: brand_quick_add`); `add_to_wishlist`; Algolia Insights clicks/conversions.

## 8. Acceptance criteria

- [ ] Every seeded brand renders with logo, description, and only its own products.
- [ ] Filters within the brand page never surface another brand's products (pinned filter can't be cleared).
- [ ] Editing the brand description in admin updates the page within 60s.
- [ ] Rich Results test passes for `Brand` + `BreadcrumbList`.
- [ ] 404 for unknown slugs; 301 for a renamed slug (test with one rename).
