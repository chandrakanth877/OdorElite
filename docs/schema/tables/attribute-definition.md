# `attribute_definition`

## Purpose

The registry that makes variation *explicit*. Every attribute a product or variant can carry is declared here: its value type, its scope (product-level vs variant-level), whether it is a **variating** attribute (distinguishes sibling variants under one master — what Shopify calls "options"), and whether it is exposed as a search facet. `attribute_value` rows are validated against this registry; nothing free-form enters the catalog.

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `id` | `text` | no | — | PK | `attr_` + code | derived | `attr_size_ml` |
| `code` | `text` | no | — | UNIQUE | Stable machine name | seed list | `size_ml` |
| `label` | `text` | no | — | — | Display label | seed list | `Size (ml)` |
| `type` | `attribute_type` | no | — | — | `text` / `number` / `boolean` / `enum` | seed list | `number` |
| `scope` | `attribute_scope` | no | — | — | `product` or `variant` | seed list | `variant` |
| `is_variating` | `boolean` | no | `false` | only valid when `scope='variant'` (CHECK) | Distinguishes sibling variants | seed list | `true` |
| `enum_values` | `text[]` | yes | — | required iff `type='enum'` (CHECK) | Allowed values | seed list | `{spray, refill}` |
| `facetable` | `boolean` | no | `false` | — | Exposed to search/filter index | seed list | `true` |
| `unit` | `text` | yes | — | — | Display unit for numbers | seed list | `ml` |
| `position` | `integer` | no | `0` | — | Display order on PDP | seed list | `1` |

## Seed registry

| code | type | scope | variating | facetable | Populated from |
|---|---|---|---|---|---|
| `size_ml` | number | variant | ✅ | ✅ | size parsed from title/variant (`3.4 oz` → 100) |
| `size_oz` | number | variant | ✅ | — | same parse, oz kept for US display |
| `concentration` | enum | variant | ✅ | ✅ | concentration map; variant-level for rare mixed masters, normally uniform (decision 2 splits EDP/Parfum into separate products) |
| `is_tester` | boolean | variant | ✅ | ✅ | title/`product_type` contains tester markers (decision 3) |
| `refill_type` | enum (`spray`,`refill`) | variant | ✅ | — | refillable/refill title markers |
| `edition` | text | variant | ✅ | — | limited/collector edition markers |
| `fragrance_family` | text | product | — | ✅ | mirrored from `fragrance_profile.family` at emit |
| `is_clone` | boolean | product | — | ✅ | `DUPE` tag (627 `[verified]`) |

## Indexes & uniques

- `UNIQUE (code)`.

## Invariants

- `is_variating = true` ⇒ `scope = 'variant'`.
- `type = 'enum'` ⇔ `enum_values` is non-null and non-empty.
- Every code referenced by `product.variating_attribute_codes` or `attribute_value` exists here.

## Formation notes

Seeded statically (table above) before any product import; new attributes are added by migration, never ad hoc at import time. Facetable product-scope attributes are *mirrors* of typed columns (e.g. `fragrance_profile.family`) written at emit so the search indexer reads one uniform surface.

## Open questions / confirm-locally

- Whether any master genuinely mixes concentrations across its variants after grouping (would rely on `concentration` as a variating attribute rather than a product split) `[confirm-locally]`.
