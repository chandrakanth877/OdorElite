# TRD 03 — Brand Index

## 1. Purpose & success metric

A–Z directory of all brands — both a navigation surface for brand-loyal shoppers and an SEO hub distributing link equity to brand pages. **KPI: brand-index → brand-page CTR; secondary: organic entrances to `/brands`.**

## 2. Route & rendering

- Route: `/brands`
- ISR, revalidate 24h + on-demand when a brand is created/updated (Medusa subscriber revalidates tag `brands`).

## 3. Layout & components

| Section | Component | Notes |
|---|---|---|
| Breadcrumbs + H1 | `Breadcrumbs`, "All Brands" | |
| Featured brands | `BrandCardGrid` | 6–8 flagged brands with logos + product counts |
| Alphabet jump bar | `AlphaNav` | sticky; letters with no brands disabled; anchors `#a`…`#z` |
| A–Z listing | `BrandAlphaList` | grouped by letter: brand name (link), country flag/label, product count, `is_niche` badge |
| Niche/designer toggle | `SegmentToggle` | client-side filter over the rendered list |

## 4. Data requirements

- Medusa custom endpoint or store query: all `brand` rows with published-product counts (`GET /store/brands` — thin custom route over the brand module), fetched server-side, tagged `brands`.
- Cloudinary logos via `t_card` for featured grid.

## 5. Interactions & states

- Alphabet bar scroll-jumps with sticky-header offset; active letter highlights on scroll (IntersectionObserver).
- Niche/designer toggle filters instantly, no URL change (single indexable version).
- Brands with 0 published products are excluded from the payload server-side.
- Empty state is impossible post-seed; still render gracefully if the list is short (no jump bar under 15 brands).

## 6. SEO

Title `Fragrance Brands A–Z | OdorElite`; self-canonical; `BreadcrumbList` JSON-LD; every brand link is a plain `<a href>` in initial HTML (this page exists to be crawled); listed in `sitemap-brands.xml`. Rules: [seo-requirements](../04-cross-cutting/seo-requirements.md).

## 7. Analytics events

`page_view`; `select_promotion` on featured brand cards (`promotion_id: brand_{slug}`); PostHog `brand_index_jump` (letter) and `brand_index_toggle` (niche/designer).

## 8. Acceptance criteria

- [ ] Every brand with ≥1 published product appears exactly once, alphabetized (case/diacritic-insensitive — "Étienne" sorts under E).
- [ ] Adding a brand in Medusa admin appears here within 60s (on-demand revalidation).
- [ ] Jump bar letters with no brands are disabled, not broken anchors.
- [ ] View-source shows all brand links server-rendered.
