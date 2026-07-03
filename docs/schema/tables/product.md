# `product`

## Purpose

One row per PDP — the shoppable concept, not the buyable unit. A product is either a derived **master** holding multiple size/tester variants (`kind = variant_master`), a **standalone** with exactly one variant (`kind = standard`), a **bundle** (gift set), or a non-physical kind (`service`, `warranty`, `gift_card`). The source data has one Shopify product *per size* `[verified]`; the grouping ladder merges size siblings into one product row here (~341 groups / 738 records collapse; expected final count ≈ 4,600–4,800 products from 5,428 sources `[confirm-locally]`).

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `id` | `text` | no | — | PK | `prod_` + hash(brand_folded, name_folded, concentration, gender); pinned in lock file | derived | `prod_a8c1q0` |
| `kind` | `product_kind` | no | — | — | See [`enums.md`](../enums.md) | derived: grouping + classification | `variant_master` |
| `item_category` | `item_category` | no | — | — | Fixed classification | derived: `source.product_type` + title regex ladder | `fragrance` |
| `slug` | `text` | no | — | UNIQUE | `{brand-slug}-{name-slug}`; **no size** (sizes are variants); concentration suffix only to disambiguate split masters | derived | `carolina-herrera-good-girl` |
| `brand_id` | `text` | no | — | FK → `brand.id` | — | `source.vendor` via brand map | `brand_9f2ka7` |
| `title` | `text` | no | — | — | Display name, size/gender/concentration tokens stripped | `source.title` cleaned (raw kept in `source_ref.title_raw`) | `Good Girl` |
| `line_name` | `text` | yes | — | — | Fragrance line for `same_line` grouping display | derived: YGroup + name-prefix analysis | `Good Girl` |
| `gender` | `gender` | yes | — | — | Null for non-fragrance kinds | `enriched.gender` via gender map (~30 spellings `[verified]`) | `women` |
| `description` | `text` | yes | — | — | Long description, HTML sanitized | `source.body_html` sanitized; fallback `enriched` description | — |
| `short_description` | `text` | yes | — | — | Card/meta copy | derived: first sentence or enrichment summary | — |
| `status` | `product_status` | no | `'draft'` | — | OOS stays `active` (decision 1); skin/candles `draft` (decision 4) | derived | `active` |
| `variating_attribute_codes` | `text[]` | no | `'{}'` | each ∈ `attribute_definition.code` | Which attributes distinguish this product's variants | derived from grouping | `{size_ml, is_tester}` |
| `seo_title` | `text` | yes | — | ≤60 chars (CHECK length) | Template `{brand} {name} {oz} oz {CONC} \| OdorElite` | derived | `Carolina Herrera Good Girl 2.7 oz EDP \| OdorElite` |
| `seo_description` | `text` | yes | — | ≤160 chars (CHECK length) | — | derived from description | — |
| `tags` | `text[]` | no | `'{}'` | — | Residual source tags **after** attribute extraction (DUPE/LIMITn/YGroup/price bands removed) | `source.tags` minus extracted | `{floral, sweet}` |
| `published_at` | `timestamptz` | yes | — | — | First storefront publish time | `source.published_at` | — |

## Indexes & uniques

- `UNIQUE (slug)`; `UNIQUE` on the natural-key hash input via `id` determinism.
- Indexes: `(brand_id)`, `(status)`, `(item_category)`, GIN on `tags`.

## Invariants

- Every product has ≥1 variant; `kind = standard` ⇒ exactly 1 variant; `kind = variant_master` ⇒ ≥2 variants.
- `kind = bundle` ⇔ has `bundle_item` rows.
- Every code in `variating_attribute_codes` exists in `attribute_definition` with `is_variating = true`.
- Every `active` product has a `media` row with role `main` **or** an open `review_flag` (`missing_image` — 135 source records `[verified]`).
- `seo_title` ≤ 60 chars, `seo_description` ≤ 160 chars.

## Formation notes

Produced by the grouping ladder: (1) exact key match on (brand_folded, name_folded, concentration, gender); (2) `YGroup_*` tags create `same_line` **relations only**, never merges `[verified: groups mix concentrations/genders]`; (3) fuzzy token-set similarity ≥ 0.90 within same concentration merges; 0.80–0.90 goes to the grouping review queue; (4) hand overrides applied last. Testers attach as variants to their parent master (decision 3). EDP vs Parfum of one name are separate products + `same_line` (decision 2).

## Open questions / confirm-locally

- Final master count (gate: 4,400–4,900) and grouping-queue size (target < 150) `[confirm-locally]`.
- Slug collisions after concentration suffixing (expected rare; collision appends `-2`).
