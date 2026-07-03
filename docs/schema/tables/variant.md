# `variant`

## Purpose

One row per **buyable SKU** — a specific size/format/tester of a product. Prices, inventory, and cart lines hang off variants, never products. Each source Shopify product (one per size `[verified]`) becomes one variant under its derived master; standalone products get exactly one variant so the storefront has a single code path.

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `id` | `text` | no | — | PK | `var_` + hash(product natural key, size, is_tester, refill) | derived | `var_77qk2e` |
| `product_id` | `text` | no | — | FK → `product.id` ON DELETE CASCADE | Parent PDP | derived: grouping | `prod_a8c1q0` |
| `sku` | `text` | no | — | UNIQUE | `OE-{BRAND4}-{NAME6}-{SIZEML}{CONC2}` + `-T` tester / `-R` refill; collision appends `-2`; pinned in lock file | derived (raw sku kept in `source_ref.sku_raw`) | `OE-CARO-GOODGI-80ED` |
| `title` | `text` | no | — | — | Buyer-facing option label | derived from attribute values | `2.7 oz Eau de Parfum` |
| `position` | `integer` | no | `0` | — | Sort order under the product (ascending size; testers last) | derived | `3` |
| `barcode` | `text` | yes | — | — | UPC/EAN when present | `source.variants[].barcode` `[confirm-locally: field presence]` | — |
| `weight_grams` | `integer` | yes | — | — | Shipping weight | `source.variants[].grams` `[confirm-locally]` | `450` |
| `status` | `product_status` | no | `'active'` | — | Variant-level retirement without touching siblings | derived | `active` |

Variant *attributes* (size_ml, size_oz, concentration, is_tester, refill_type, edition) live in [`attribute_value`](./attribute-value.md), validated against the registry — not as columns here, so new variation axes never need a migration.

## Indexes & uniques

- `UNIQUE (sku)`.
- Index `(product_id, position)`.

## Invariants

- Every variant has ≥1 `price` row of kind `list` with `amount_cents > 0` — unless its product is `draft` (the 10 zero-price placeholder rows `[verified]` become `service`/`draft`).
- Every variant has exactly one `inventory_record`.
- The variant's `attribute_value` set **covers every code** in its product's `variating_attribute_codes`, and the value-tuple is **unique among siblings** (no two identical variants under one master).
- SKU matches the minting grammar; published SKUs never change across pipeline re-runs (lock file).

## Formation notes

Emitted per deduped source record after grouping: sizes parsed from title/variant title into `size_ml`/`size_oz` (e.g. `3.4 oz` → 100 ml); tester detection sets `is_tester` and appends `-T` to the SKU (decision 3). `CONC2` codes: PF parfum · EX extrait · ED edp · ET edt · EC edc · CO cologne · EF eau_fraiche · PO perfume_oil · AT attar · BM body_mist · BS body_spray · HM hair_mist · DE deodorant · AS aftershave · CA candle · RS room_spray · OT other.

## Open questions / confirm-locally

- Exact fields available on `source.variants[]` (barcode, grams, option1–3) `[confirm-locally]` — the mapping matrix marks each.
- Whether any source product carries multiple Shopify variants itself (would emit multiple variants from one source record) `[confirm-locally]`.
