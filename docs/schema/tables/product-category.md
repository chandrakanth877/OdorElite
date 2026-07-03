# `product_category`

## Purpose

Join table: which products appear in which categories, with per-category ordering. Pure M:N join — no surrogate id.

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `product_id` | `text` | no | — | PK part, FK → `product.id` ON DELETE CASCADE | — | derived | `prod_a8c1q0` |
| `category_id` | `text` | no | — | PK part, FK → `category.id` ON DELETE CASCADE | — | derived | `cat_3jx91m` |
| `position` | `integer` | no | `0` | — | Manual sort within the category (0 = auto) | curated | `0` |
| `created_at` | `timestamptz` | no | `now()` | — | — | — | — |

## Indexes & uniques

- `PRIMARY KEY (product_id, category_id)`.
- Index on `category_id` (category page listing is the hot path).

## Invariants

- Every `active` product has ≥1 category assignment.
- A product's categories are consistent with its `gender`/`item_category` (checked by the validator, not the database).

## Formation notes

Written in the emit stage after classification: each product gets its `gender` × `item_category` leaf plus any curated extras (e.g. New Arrivals by `published_at`).
