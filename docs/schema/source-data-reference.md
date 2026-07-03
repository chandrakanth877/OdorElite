# Source Data Reference — `enriched-products.jsonl`

Field-by-field inventory of the scrape output (`ecommerce-scraper/ai-enrichment-agent/output/enriched-products.jsonl`, not stored in this repo). One JSON object per line: a raw Shopify `source` block and a Gemini `enriched` block. Run [`validation/validate-source-reference.mjs`](./validation/validate-source-reference.mjs) against the real file to verify everything on this page; fields marked `[confirm-locally]` were not directly inspected in the analysis session and the script reports their actual presence/shape.

## File-level facts `[verified]`

| Fact | Value |
|---|---|
| Total lines | 5,560 |
| Distinct `source.id` | 5,428 |
| Duplicate retry lines (same `source.id`, later line has enrichment) | 132 |
| Stale lines with empty/placeholder enrichment | 126 |
| Records enriched **without** web grounding | 4,092 |
| Records with `compare_at_price` set (i.e. "on sale") | 99.1% |
| Records `available: false` | ≈83% |
| Zero-price placeholder rows ("Pickup Instore" type) | 10 |
| Records with zero images | 135 |
| Records tagged `DUPE` | 627 |
| Records with `YGroup_*` tags | 61 (24 groups) |
| Implicit size-sibling groups (same normalized brand+name+concentration+gender) | ≈341 groups / 738 records |
| Distinct gender spellings | ≈30 |
| Distinct concentration spellings | 47 |

## `source` block (Shopify product JSON)

| Field | Type | Notes | Status |
|---|---|---|---|
| `source.id` | number | Shopify product id — **the dedupe key** | `[verified]` |
| `source.title` | string | Carries brand, size, gender, concentration tokens (e.g. "Good Girl by Carolina Herrera 2.7 oz EDP for Women") | `[verified]` |
| `source.handle` | string | URL handle | `[verified]` |
| `source.vendor` | string | Brand — accent/case inconsistent | `[verified]` |
| `source.product_type` | string | Primary classification input | `[verified]` |
| `source.tags` | string[] | Encodes `DUPE`, `LIMIT1`–`LIMIT3`, `YGroup_*`, price bands, descriptive tags | `[verified]` |
| `source.body_html` | string | Long description, HTML | `[confirm-locally: field name]` |
| `source.published_at` / `created_at` / `updated_at` | string (ISO) | — | `[confirm-locally]` |
| `source.variants[]` | object[] | Usually length 1 (one Shopify product per size) | `[verified: sizes are separate products]` |
| `source.variants[].id` | number | Shopify variant id | `[verified]` |
| `source.variants[].price` | string (decimal) | → `price.kind = list` | `[verified]` |
| `source.variants[].compare_at_price` | string/null | **MSRP in practice** → `price.kind = msrp` | `[verified: 99.1% set]` |
| `source.variants[].sku` | string | Merchant SKU → `source_ref.sku_raw` | `[verified]` |
| `source.variants[].available` | boolean | 83% false | `[verified]` |
| `source.variants[].title` / `option1..3` | string | Size/format text | `[confirm-locally]` |
| `source.variants[].grams` / `barcode` | number / string | Shipping weight, UPC | `[confirm-locally]` |
| `source.images[]` | object[] | 135 records have none | `[verified: count]` |
| `source.images[].src` | string | Shopify CDN URL | `[verified]` |
| `source.images[].position` / `width` / `height` | number | — | `[confirm-locally]` |
| `source.options[]` | object[] | Shopify options — expected trivial ("Title") given one-variant products | `[confirm-locally]` |

## `enriched` block (43 fields, Gemini)

Universal quirk `[verified]`: missing data is the **string `"N/A"`**, not null — the pipeline nulls it everywhere. High-N/A fields: `oil_percentage` ≈99%, `awards` ≈95%, season ratings ≈99%; `perfumer`/`launch_year` heavily N/A on the 4,092 non-grounded records.

Known fields and destinations (full matrix in [`source-to-schema-mapping.md`](./source-to-schema-mapping.md)):

| Field (name `[confirm-locally]` unless noted) | Type | Destination |
|---|---|---|
| `brand`, `product_name` | string | cross-check vs `source.vendor`/title; normalization inputs |
| `gender` | string (~30 spellings `[verified]`) | `product.gender` via map |
| `concentration` | string (47 spellings `[verified]`) | `fragrance_profile.concentration` via map |
| `fragrance_family`, subfamily | string | `fragrance_profile.family` / `.subfamily` |
| `top_notes`, `middle_notes`, `base_notes` | string/array | `notes_top` / `notes_heart` / `notes_base` |
| `main_accords` | string/array | `accords` |
| `perfumer` | string (inconsistent separators) | `perfumer[]` |
| `launch_year` | string/number | `launch_year` |
| `longevity`, `sillage` | string scale | enum columns `[confirm-locally: scale values]` |
| `season_rating`(s) | string/number, ~99% N/A `[verified]` | `season_*` scores |
| `occasion` | string/array | `occasions` |
| `oil_percentage` | ~99% N/A `[verified]` | `oil_percentage` |
| `awards` | ~95% N/A `[verified]` | `awards` |
| `similar_fragrances` | string/array | `product_relation` (`similar`, resolve-else-external) |
| inspired-by / clone fields | string | `is_clone`, `clone_of_external`, `dupe_of` relation |
| description/summary fields | string | `product.description` fallback, `short_description` |
| `confidence`, model, web-grounding flag, timestamp | mixed | `enrichment_*` provenance columns |

The remaining enriched fields (to total 43) must be inventoried on the first local run — the validation script **prints every field name it encounters that is not listed in `expectations.json`**, which is the completion mechanism for this table.
