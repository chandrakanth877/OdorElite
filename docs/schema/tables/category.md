# `category`

## Purpose

Storefront navigation tree (adjacency list via `parent_id`). Categories are *merchandising* groupings (Women's Perfume, Gift Sets, New Arrivals) — distinct from `product.item_category`, which is a fixed classification enum. A product joins any number of categories through `product_category`.

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `id` | `text` | no | — | PK | `cat_` + hash of path | derived | `cat_3jx91m` |
| `slug` | `text` | no | — | UNIQUE | URL segment (full-path slug) | derived | `women-perfume` |
| `name` | `text` | no | — | — | Display name | derived from taxonomy seed | `Perfume` |
| `parent_id` | `text` | yes | — | FK → `category.id` | Null for root categories | derived | `cat_root_women` |
| `position` | `integer` | no | `0` | — | Sort order among siblings | curated | `1` |
| `description` | `text` | yes | — | — | Category landing copy (SEO surface) | curated later | — |
| `seo_title` | `text` | yes | — | — | ≤60 chars | curated later | — |
| `seo_description` | `text` | yes | — | — | ≤160 chars | curated later | — |
| `status` | `product_status` | no | `'active'` | — | Draft categories hidden | derived (skin/candle trees start `draft`, decision 4) | `active` |

## Indexes & uniques

- `UNIQUE (slug)`; `UNIQUE (parent_id, name)`.
- Index on `parent_id` for tree walks.

## Invariants

- No cycles (parent chain terminates at a root).
- Every `product_category.category_id` resolves.
- A `draft` category has no `active` descendant categories.

## Formation notes

Seeded from a small hand-written taxonomy (roots: Women, Men, Unisex, Kids, Gift Sets, Testers-fallback, Home Fragrance, Skin & Beauty), then products are assigned by classification output: `gender` × `item_category` → leaf category. Home Fragrance and Skin & Beauty trees are created `status = draft` at launch (decision 4).

## Open questions / confirm-locally

- Whether price-band tags (`[verified]` present in source tags) become categories ("Under $50") or search facets — recommendation: facets only, categories stay curatorial.
