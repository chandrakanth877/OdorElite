# `bundle_item`

## Purpose

Composition of a bundle (gift set): which items it contains and in what quantity. Only products with `kind = bundle` have rows here (≈21 gift sets in source `[confirm-locally: exact count]`). Components are usually *not* standalone catalog SKUs (a set's 10 ml travel spray isn't sold separately), so a component is either a catalog variant reference **or** a free-text description.

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `id` | `text` | no | — | PK | `bitem_` + hash(bundle, position) | derived | `bitem_aa10x2` |
| `bundle_product_id` | `text` | no | — | FK → `product.id` ON DELETE CASCADE | The gift set | derived: classification (title/product_type "gift set") | `prod_gset01` |
| `item_variant_id` | `text` | yes | — | FK → `variant.id` | Component when it exists as a catalog SKU | derived: fuzzy resolve | — |
| `item_description` | `text` | yes | — | — | Component when external (size + form) | parsed from `source.body_html` / title `[confirm-locally: parseability]` | `3.4 oz EDP spray + 0.34 oz travel spray` |
| `quantity` | `integer` | no | `1` | CHECK `> 0` | Units of this component | parsed | `1` |
| `position` | `integer` | no | `0` | — | Display order | parsed order | `1` |

CHECK: exactly one of (`item_variant_id`, `item_description`) is non-null.

## Indexes & uniques

- Index `(bundle_product_id, position)`.

## Invariants

- `bundle_product_id` resolves to a product with `kind = 'bundle'`; a bundle product has ≥1 row here.
- The bundle itself is priced on its own variant (sets sell as one SKU) — component rows carry no prices.

## Formation notes

Gift sets classify as `kind = bundle`, `item_category = gift_set`, with **one variant** (the set as sold). Component parsing from body copy is best-effort at import: unparsed sets get a single `item_description` of the raw contents line + review flag. Medusa adapter note: gift sets export as plain products initially; bundle composition is metadata until a bundle module exists.
