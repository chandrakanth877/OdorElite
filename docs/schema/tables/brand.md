# `brand`

## Purpose

One row per canonical fragrance house / manufacturer. Every product references exactly one brand. Brands are the unit of accent normalization: the source data spells the same house inconsistently (`Lancome`, `Lancôme`, `LANCOME` `[verified]`), which breaks grouping keys — so the canonical row keeps the display spelling while `name_folded` + `aliases` provide the matching surface.

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `id` | `text` | no | — | PK | Deterministic, `brand_` + hash of `name_folded` | derived | `brand_9f2ka7` |
| `slug` | `text` | no | — | UNIQUE | URL segment | derived: slugified folded name | `carolina-herrera` |
| `name` | `text` | no | — | — | Canonical display name, accents preserved | `source.vendor` via `brand-aliases` map | `Carolina Herrera` |
| `name_folded` | `text` | no | — | UNIQUE | Lowercased, accent-folded matching key | derived: unicode NFKD fold of `name` | `carolina herrera` |
| `aliases` | `text[]` | no | `'{}'` | — | All source spellings that resolve to this brand | derived: collected during normalization | `{lancome, lancôme, LANCOME}` |
| `logo_url` | `text` | yes | — | — | Brand logo (also the placeholder image for the 135 image-less products `[verified]`) | n/a — curated later | `https://cdn…/ch.png` |
| `description` | `text` | yes | — | — | Brand story for brand landing pages | n/a — curated / enrichment later | — |
| `website_url` | `text` | yes | — | — | Official site | n/a — curated later | — |
| `status` | `product_status` | no | `'active'` | — | Draft brands hidden from nav | derived | `active` |

## Indexes & uniques

- `UNIQUE (slug)`, `UNIQUE (name_folded)`.
- GIN index on `aliases` for reverse lookup during import.

## Invariants

- Every `product.brand_id` resolves to a brand row.
- `name_folded` = fold(`name`) — enforced by the pipeline, spot-checked by the validator.
- No two brands share an alias.

## Formation notes

Populated first (dependency root). Distinct `source.vendor` values are folded and clustered; the `brand-aliases` map (hand-curated) merges spelling variants; the most-frequent accented spelling wins as display `name`. Unmapped vendors → `unmapped_value` review flag, imported verbatim as their own brand until reviewed.

## Open questions / confirm-locally

- Exact distinct `vendor` count and the full alias clusters `[confirm-locally]`.
- Multi-brand gift sets: `brand` holds the *selling* vendor from source; whether a "Various" brand is needed depends on real gift-set vendors `[confirm-locally]`.
