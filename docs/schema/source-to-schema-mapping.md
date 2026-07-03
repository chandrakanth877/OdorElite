# Source → Schema Mapping Matrix

Every source field maps to a `table.column`, is a derivation input, or is explicitly ignored with a reason. Field names marked ⚠ are `[confirm-locally]` — verify with the validation script before pipeline implementation.

## `source` block

| Source field | Destination | Transform |
|---|---|---|
| `source.id` | `source_ref.source_product_id` | dedupe key: keep the line with non-empty enrichment per id (drops 132 + 126 lines `[verified]`) |
| `source.title` | `source_ref.title_raw`; input to `product.title`, `variant` size parse | strip brand/size/gender/concentration tokens for display title; parse `size_ml`/`size_oz` |
| `source.handle` | `source_ref.source_handle` | verbatim; also 301-redirect seed for SEO |
| `source.vendor` | `brand.*` via alias map → `product.brand_id` | accent-fold + alias cluster |
| `source.product_type` | input to `product.item_category` + `kind` | classification ladder |
| `source.tags[]` — `DUPE` | `fragrance_profile.is_clone`, `attribute_value(is_clone)`, `product_relation(dupe_of)` | extract |
| `source.tags[]` — `LIMIT1..3` | `inventory_record.purchase_limit` | extract, int |
| `source.tags[]` — `YGroup_*` | `product_relation(same_line)` + `product.line_name` | extract; **never a merge key** `[verified]` |
| `source.tags[]` — price bands | cross-check vs `price.amount_cents`; not stored | mismatch → review flag |
| `source.tags[]` — residual | `product.tags` | after extraction |
| `source.body_html` ⚠ | `product.description` | sanitize HTML; first sentence → `short_description` |
| `source.published_at` ⚠ | `product.published_at` | parse ISO |
| `source.created_at`/`updated_at` ⚠ | ignored | scrape-side timestamps, not catalog facts |
| `source.variants[].id` | `source_ref.source_variant_id` | verbatim |
| `source.variants[].price` | `price(kind=list).amount_cents` | decimal string → integer cents (string math) |
| `source.variants[].compare_at_price` | `price(kind=msrp).amount_cents` | same; drop + flag if ≤ list `[confirm-locally: count]` |
| `source.variants[].sku` | `source_ref.sku_raw` | verbatim (our SKU is minted) |
| `source.variants[].available` | `inventory_record.quantity` | false → 0; true → seeded placeholder + flag (boolean only in source) |
| `source.variants[].title`/`option1..3` ⚠ | size parse fallback | when title parse fails |
| `source.variants[].grams` ⚠ | `variant.weight_grams` | verbatim |
| `source.variants[].barcode` ⚠ | `variant.barcode` | verbatim |
| `source.variants[].requires_shipping`/`taxable` ⚠ | ignored | uniform for this catalog; revisit for services |
| `source.images[].src` | `media.source_url` → re-hosted `media.url` | mirror to own CDN |
| `source.images[].position` ⚠ | `media.position`, role `main` for first | — |
| `source.images[].width`/`height` ⚠ | `media.width`/`.height` | verbatim |
| `source.options[]` ⚠ | ignored | trivial for one-variant products; validation confirms |

## `enriched` block

| Enriched field | Destination | Transform |
|---|---|---|
| `brand` ⚠ | cross-check vs `source.vendor` | mismatch → `name_anomaly` flag |
| `product_name` ⚠ | input to `product.title`, grouping key | normalization |
| `gender` | `product.gender` | gender map (~30 spellings `[verified]`); unmapped → queue |
| `concentration` | `fragrance_profile.concentration`, `attribute_value(concentration)` | concentration map (47 spellings `[verified]`) |
| `fragrance_family` ⚠ | `fragrance_profile.family` (+ facet mirror) | lowercase, N/A→null |
| `top_notes` / `middle_notes` / `base_notes` ⚠ | `notes_top` / `notes_heart` / `notes_base` | split/trim to text[]; N/A→`{}` |
| `main_accords` ⚠ | `accords` | same |
| `perfumer` | `perfumer[]` | split on `,` `&` ` and `; N/A→`{}` |
| `launch_year` | `launch_year` | int, range-check 1900–2100; N/A→null |
| `longevity` / `sillage` ⚠ | enum columns | scale map `[confirm-locally]`; unmapped → queue |
| season rating(s) ⚠ | `season_spring..winter` | ~99% N/A `[verified]` → null |
| `occasion` ⚠ | `occasions` | to text[] |
| `oil_percentage` | `oil_percentage` | ~99% N/A `[verified]` → null |
| `awards` | `awards` | ~95% N/A `[verified]` → `{}` |
| `similar_fragrances` ⚠ | `product_relation(similar)` | fuzzy resolve ≥0.90 into catalog else `to_external_name` |
| inspired-by/clone field ⚠ | `clone_of_external`, `product_relation(dupe_of)` | with `DUPE` tag corroboration |
| description/summary ⚠ | `product.description` fallback, `short_description` | when `body_html` empty |
| `confidence` ⚠ | `enrichment_confidence` | 0–1 |
| model / web-grounding flag / timestamp ⚠ | `enrichment_model`, `enrichment_web_grounded`, `enriched_at` | grounded=false (4,092 `[verified]`) → `needs_re_enrichment` flag |

**Completion rule:** the enriched block has 43 fields total `[verified: count]`. Any field the validation script encounters that is absent from this matrix (via `expectations.json.knownEnrichedFields`) is printed as `UNDOCUMENTED FIELD` and must be added here — mapped or ignored-with-reason — before the pipeline ships.
