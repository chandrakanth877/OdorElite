# `fragrance_profile`

## Purpose

The fragrance vertical's typed data — 1:0..1 with `product` (null for non-fragrance kinds). Deliberately **not** EAV: one vertical with a fixed, strongly-typed shape keeps queries, validation, and enrichment round-trips simple. Facetable fields are mirrored into `attribute_value` at emit so search reads one surface. Populated from the Gemini `enriched` block (43 fields; 4,092 records enriched **without** web grounding `[verified]` → lower trust, queued for re-enrichment).

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `product_id` | `text` | no | — | PK, FK → `product.id` ON DELETE CASCADE | 1:0..1 | derived | `prod_a8c1q0` |
| `concentration` | `concentration` | yes | — | — | Product-level concentration (decision 2: one per product) | `enriched.concentration` via map (47 spellings `[verified]`) | `edp` |
| `family` | `text` | yes | — | — | Olfactory family | `enriched.fragrance_family` | `amber floral` |
| `subfamily` | `text` | yes | — | — | Secondary family | `enriched` `[confirm-locally: field name]` | — |
| `notes_top` | `text[]` | no | `'{}'` | — | Top notes | `enriched.top_notes` (N/A → empty) | `{almond, coffee}` |
| `notes_heart` | `text[]` | no | `'{}'` | — | Heart/middle notes | `enriched.middle_notes` `[confirm-locally: field name]` | `{tuberose, jasmine}` |
| `notes_base` | `text[]` | no | `'{}'` | — | Base notes | `enriched.base_notes` | `{tonka bean, cacao}` |
| `accords` | `text[]` | no | `'{}'` | — | Main accords | `enriched.main_accords` `[confirm-locally]` | `{sweet, vanilla}` |
| `perfumer` | `text[]` | no | `'{}'` | — | Nose(s) — array; source is inconsistent string | `enriched.perfumer` split on `,`/`&`/` and ` | `{Louise Turner}` |
| `launch_year` | `smallint` | yes | — | CHECK 1900–2100 | — | `enriched.launch_year` (high N/A on non-grounded `[verified]`) | `2016` |
| `longevity` | `longevity` | yes | — | — | Enum, see enums.md `[confirm-locally: scale]` | `enriched.longevity` | `long_lasting` |
| `sillage` | `sillage` | yes | — | — | Enum `[confirm-locally: scale]` | `enriched.sillage` | `strong` |
| `season_spring` | `numeric(3,2)` | yes | — | CHECK 0–1 | Suitability score | `enriched.season_rating` (~99% N/A `[verified]`) | `0.40` |
| `season_summer` | `numeric(3,2)` | yes | — | CHECK 0–1 | — | same | `0.25` |
| `season_fall` | `numeric(3,2)` | yes | — | CHECK 0–1 | — | same | `0.90` |
| `season_winter` | `numeric(3,2)` | yes | — | CHECK 0–1 | — | same | `0.85` |
| `occasions` | `text[]` | no | `'{}'` | — | e.g. evening, office | `enriched.occasion` `[confirm-locally]` | `{evening, date}` |
| `oil_percentage` | `numeric(4,1)` | yes | — | CHECK 0–100 | 99% N/A `[verified]` → almost always null | `enriched.oil_percentage` | — |
| `awards` | `text[]` | no | `'{}'` | — | 95% N/A `[verified]` | `enriched.awards` | — |
| `is_clone` | `boolean` | no | `false` | — | Inspired-by / dupe product | `DUPE` tag (627 `[verified]`) + `enriched` clone fields | `true` |
| `clone_of_external` | `text` | yes | — | — | Name of the imitated fragrance when not in catalog (also emitted as `dupe_of` relation) | `enriched` inspired-by field `[confirm-locally]` | `Baccarat Rouge 540` |
| `is_flanker` | `boolean` | no | `false` | — | Line extension of a pillar | derived from name analysis + enrichment | `false` |
| `parent_fragrance` | `text` | yes | — | — | Pillar name (also `flanker_of` relation when resolvable) | derived | — |
| `enrichment_confidence` | `numeric(3,2)` | yes | — | CHECK 0–1 | Model self-score | `enriched.confidence` `[confirm-locally]` | `0.87` |
| `enrichment_model` | `text` | yes | — | — | Producing model id | enrichment metadata | `gemini-2.5-pro` |
| `enrichment_web_grounded` | `boolean` | no | `false` | — | Whether web grounding was on (4,092 false `[verified]`) | enrichment metadata | `false` |
| `enriched_at` | `timestamptz` | yes | — | — | When enrichment ran | enrichment metadata | — |

## Indexes & uniques

- PK = FK (`product_id`).
- GIN on `notes_top`/`notes_heart`/`notes_base`/`accords` (note search); index on `family`.

## Invariants

- Owner product's `item_category` ∈ {fragrance, tester, miniature, body_spray, gift_set} — no profile on skin_beauty/candle/misc (candles carry scent info in description instead; revisit if needed).
- Zero `"N/A"` strings anywhere (pipeline converts to NULL/empty-array).
- `enrichment_web_grounded = false` ⇒ product appears in the re-enrichment queue.

## Formation notes

The enriched block maps field-by-field per [`source-to-schema-mapping.md`](../source-to-schema-mapping.md). All 43 enriched fields must be accounted for there — mapped, or explicitly ignored with a reason; the validation script fails on any undocumented field.

## Open questions / confirm-locally

- Exact enrichment field names and the longevity/sillage scales `[confirm-locally]` — the mapping matrix marks every guess.
- Whether season data is a single rating vs per-season scores in the real payload (~99% N/A either way `[verified]`).
