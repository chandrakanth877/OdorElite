# Enum Types

All Postgres enum types used by the schema, with the **source-spelling → canonical** maps that the import pipeline applies. Unknown source spellings are never silently guessed — they land in the `unmapped-values` review queue and the row gets a `review_flag`.

Spelling lists below are the representative sets captured during analysis; the exhaustive lists (~30 gender spellings, 47 concentration spellings `[verified]` as counts) must be confirmed by running `validation/validate-source-reference.mjs` against the real JSONL `[confirm-locally]`.

## `gender` (4 values)

Canonical: `women` · `men` · `unisex` · `kids`

| Canonical | Source spellings observed (representative) |
|---|---|
| `women` | `Women`, `WOMEN`, `women`, `Woman`, `Ladies`, `Female`, `For Her`, `W`, `Womens`, `Women's` |
| `men` | `Men`, `MEN`, `men`, `Man`, `Male`, `For Him`, `M`, `Mens`, `Men's`, `Gentlemen` |
| `unisex` | `Unisex`, `UNISEX`, `unisex`, `Men & Women`, `Women & Men`, `Shared`, `All` |
| `kids` | `Kids`, `Children`, `Child`, `Baby`, `Boys`, `Girls` |

## `concentration` (17 values)

Canonical: `parfum` · `extrait` · `edp` · `edt` · `edc` · `cologne` · `eau_fraiche` · `perfume_oil` · `attar` · `body_mist` · `body_spray` · `hair_mist` · `deodorant` · `aftershave` · `candle` · `room_spray` · `other`

| Canonical | Source spellings observed (representative) |
|---|---|
| `parfum` | `Parfum`, `Pure Parfum`, `Perfume` (when meaning parfum strength) |
| `extrait` | `Extrait`, `Extrait de Parfum`, `Elixir` (brand-dependent — review queue) |
| `edp` | `Eau de Parfum`, `EDP`, `Eau De Parfum`, `Eau de Parfum Spray`, `eau_de_parfum` |
| `edt` | `Eau de Toilette`, `EDT`, `Eau De Toilette Spray`, `eau_de_toilette` |
| `edc` | `Eau de Cologne`, `EDC` |
| `cologne` | `Cologne`, `Cologne Spray` (US-market men's naming, not EDC strength) |
| `eau_fraiche` | `Eau Fraiche`, `Eau Fraîche` |
| `perfume_oil` | `Perfume Oil`, `Oil`, `Huile de Parfum`, `Roll-on Oil` |
| `attar` | `Attar`, `Ittar` |
| `body_mist` | `Body Mist`, `Fragrance Mist`, `Mist` |
| `body_spray` | `Body Spray`, `Deodorant Body Spray` |
| `hair_mist` | `Hair Mist`, `Hair Perfume`, `Hair & Body Mist` |
| `deodorant` | `Deodorant`, `Deodorant Stick`, `Deo Spray` |
| `aftershave` | `Aftershave`, `After Shave`, `After-Shave Lotion` |
| `candle` | `Candle`, `Scented Candle` |
| `room_spray` | `Room Spray`, `Home Spray`, `Pillow Mist` |
| `other` | anything unmapped after review (e.g. lotions kept as fragrance-adjacent) |

## `product_kind` (6 values)

`standard` · `variant_master` · `bundle` · `service` · `warranty` · `gift_card`

- `standard` — normal product with exactly one variant.
- `variant_master` — derived master holding 2+ size/tester variants.
- `bundle` — gift set; composition in `bundle_item`.
- `service` — non-shippable (e.g. the zero-price "Pickup Instore" placeholder rows `[verified: 10 rows]`).
- `warranty` — attachable protection product (none in source data; schema-supported).
- `gift_card` — perpetual-inventory stored-value product (none in source data; schema-supported).

## `item_category` (8 values)

`fragrance` · `tester` · `gift_set` · `miniature` · `body_spray` · `candle` · `skin_beauty` · `misc`

Assigned by the classification ladder (`product_type` + title regex). Note `tester` as an item_category applies only when a tester cannot be attached to a parent master (fallback); attached testers are variants with `is_tester = true`.

## `product_status` (3 values)

`active` · `draft` · `archived` — out-of-stock imports as `active` (decision 1); skin & beauty and candles import as `draft` (decision 4).

## `price_kind` (3 values)

`list` · `sale` · `msrp` — MSRP populated from Shopify `compare_at_price` `[verified: present on 99.1% of records]`.

## `inventory_policy` (4 values)

`tracked` · `perpetual` · `preorder` · `backorder`

## `media_role` (6 values)

`main` · `gallery` · `swatch` · `notes_pyramid` · `lifestyle` · `packaging`

`notes_pyramid` detected by filename heuristic (e.g. `*notes*`, `*pyramid*` in the CDN URL) `[confirm-locally]`.

## `relation_type` (5 values)

`similar` · `dupe_of` · `flanker_of` · `same_line` · `layering_partner`

- `dupe_of` — from `DUPE` tag (627 records `[verified]`); target usually external (`to_external_name`).
- `same_line` — from `YGroup_*` tags (61 records / 24 groups `[verified]`) and EDP-vs-Parfum splits (decision 2).
- `flanker_of` — derived (e.g. Good Girl Blush → Good Girl; Acqua di Giò Profondo → Acqua di Giò).

## `attribute_type` (4 values) / `attribute_scope` (2 values)

`text` · `number` · `boolean` · `enum` — and scope `product` · `variant`.

## `longevity` (5 values) `[confirm-locally: exact enrichment scale]`

`poor` · `weak` · `moderate` · `long_lasting` · `eternal`

## `sillage` (4 values) `[confirm-locally: exact enrichment scale]`

`intimate` · `moderate` · `strong` · `enormous`

## `flag_type` (7 values) / `flag_status` (2 values)

`missing_image` · `zero_price` · `unmapped_value` · `grouping_ambiguous` · `needs_re_enrichment` · `placeholder_price` · `name_anomaly` — status `open` · `resolved`.
