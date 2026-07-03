# `attribute_value`

## Purpose

Typed attribute values for products and variants, validated against [`attribute_definition`](./attribute-definition.md). One row = one (owner, attribute) pair. Exactly one owner column and exactly one value column is set per row, matching the definition's `scope` and `type`. This is the *generic* attribute surface — fragrance-vertical data stays in the typed [`fragrance_profile`](./fragrance-profile.md) table and is only mirrored here when facetable.

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `id` | `text` | no | — | PK | `aval_` + hash(owner, code) | derived | `aval_x21p9c` |
| `attribute_definition_id` | `text` | no | — | FK → `attribute_definition.id` | — | derived | `attr_size_ml` |
| `product_id` | `text` | yes | — | FK → `product.id` ON DELETE CASCADE | Owner when scope=product | derived | — |
| `variant_id` | `text` | yes | — | FK → `variant.id` ON DELETE CASCADE | Owner when scope=variant | derived | `var_77qk2e` |
| `value_text` | `text` | yes | — | — | Set when type=text/enum | per attribute | — |
| `value_number` | `numeric` | yes | — | — | Set when type=number | per attribute | `80` |
| `value_boolean` | `boolean` | yes | — | — | Set when type=boolean | per attribute | — |

CHECKs: exactly one of (`product_id`, `variant_id`) is non-null; exactly one of the three value columns is non-null.

## Indexes & uniques

- `UNIQUE (variant_id, attribute_definition_id)` and `UNIQUE (product_id, attribute_definition_id)` (partial, on the respective non-null owner).
- Index `(attribute_definition_id, value_text)` and `(attribute_definition_id, value_number)` for faceting queries.

## Invariants

- Owner column matches the definition's `scope`; value column matches its `type`; enum values ∈ `enum_values`.
- Variant rows for variating attributes: the tuple of values per variant is unique among siblings (see [`variant`](./variant.md)).
- For every variant, a value exists for each of the parent's `variating_attribute_codes`.

## Formation notes

Written at emit: size parses (`size_ml`/`size_oz`), concentration, `is_tester`, `refill_type`, `edition` per variant; facet mirrors (`fragrance_family`, `is_clone`) per product. The `DUPE` tag (627 records `[verified]`) sets product-scope `is_clone = true` alongside the `dupe_of` relation.
