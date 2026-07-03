# `media`

## Purpose

Images (and future video) for products and variants, with an explicit **role** so the storefront never guesses which image is the hero, the notes pyramid, or packaging. A media row belongs to exactly one owner: a product (shared across variants) or a specific variant (e.g. a tester box shot).

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `id` | `text` | no | — | PK | `media_` + hash(owner, source url) | derived | `media_k20a7x` |
| `product_id` | `text` | yes | — | FK → `product.id` ON DELETE CASCADE | Owner (product-level) | derived | `prod_a8c1q0` |
| `variant_id` | `text` | yes | — | FK → `variant.id` ON DELETE CASCADE | Owner (variant-level) | derived | — |
| `role` | `media_role` | no | `'gallery'` | — | `main` / `gallery` / `swatch` / `notes_pyramid` / `lifestyle` / `packaging` | derived: position 1 → `main`; filename heuristic → `notes_pyramid` `[confirm-locally]` | `main` |
| `url` | `text` | no | — | — | Serving URL (own CDN after mirror) | `source.images[].src` (re-hosted) | `https://cdn.odorelite.com/p/good-girl-80.jpg` |
| `source_url` | `text` | yes | — | — | Original Shopify CDN URL | `source.images[].src` | — |
| `alt` | `text` | yes | — | — | Accessibility / SEO text | derived: `{brand} {title} {variant title}` template | `Carolina Herrera Good Girl 2.7 oz bottle` |
| `width` | `integer` | yes | — | — | Pixels | `source.images[].width` `[confirm-locally]` | `1200` |
| `height` | `integer` | yes | — | — | Pixels | `source.images[].height` `[confirm-locally]` | `1200` |
| `position` | `integer` | no | `0` | — | Gallery order | `source.images[].position` | `1` |

CHECK: exactly one of (`product_id`, `variant_id`) is non-null.

## Indexes & uniques

- Partial `UNIQUE (product_id) WHERE role = 'main'` — at most one hero per product.
- Index `(product_id, position)`.

## Invariants

- Every `active` product has one `main` row **or** an open `missing_image` review flag (135 source records have zero images `[verified]` — they get the brand-logo placeholder as interim `main` plus the flag).
- `url` non-empty and HTTPS.

## Formation notes

Images import product-scoped by default (source images are per Shopify product = per size; after grouping, the master keeps the largest size's set and drops byte-identical duplicates `[confirm-locally: dedupe by URL hash]`). Role assignment: first position → `main`; filenames matching `/(notes|pyramid)/i` → `notes_pyramid`; the rest → `gallery`.
