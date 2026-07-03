# `source_ref`

## Purpose

Provenance: ties every product and variant back to the exact scraped Shopify record it came from, keeping raw values (title, sku) that normalization rewrote. This is what makes the pipeline idempotent and re-runnable — dedupe, drift detection, and re-enrichment all key off this table. A derived master has one row per merged source record (a 3-size master → 3 refs); each variant points at exactly one.

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `id` | `text` | no | — | PK | `sref_` + source ids | derived | `sref_7841…` |
| `product_id` | `text` | yes | — | FK → `product.id` ON DELETE CASCADE | Owning catalog product | derived | `prod_a8c1q0` |
| `variant_id` | `text` | yes | — | FK → `variant.id` ON DELETE CASCADE | Owning variant (when record-level) | derived | `var_77qk2e` |
| `source_platform` | `text` | no | `'shopify'` | — | — | constant | `shopify` |
| `source_store` | `text` | no | `'labelleperfumes.com'` | — | — | constant | — |
| `source_product_id` | `bigint` | no | — | — | Shopify product id — the dedupe key (5,560 lines → 5,428 distinct `[verified]`) | `source.id` | `744921874532` |
| `source_variant_id` | `bigint` | yes | — | — | Shopify variant id | `source.variants[].id` | — |
| `source_handle` | `text` | yes | — | — | Shopify URL handle | `source.handle` | `good-girl-edp-2-7` |
| `sku_raw` | `text` | yes | — | — | Merchant's original SKU (ours is minted) | `source.variants[].sku` | `CH-GG-80` |
| `title_raw` | `text` | yes | — | — | Original title before token stripping | `source.title` | `Good Girl by Carolina Herrera 2.7 oz EDP for Women` |
| `raw_hash` | `text` | no | — | — | SHA-256 of the source JSONL line — drift detection across re-scrapes | derived | `9c41…` |
| `imported_at` | `timestamptz` | no | `now()` | — | — | — | — |

CHECK: at least one of (`product_id`, `variant_id`) is non-null.

## Indexes & uniques

- `UNIQUE (source_platform, source_store, source_product_id, coalesce(source_variant_id, 0))`.
- Index `(product_id)`, `(variant_id)`.

## Invariants

- Exactly 5,428 rows expected from the initial import (one per distinct `source.id` `[verified]`); the 132 duplicate + 126 stale lines are dropped before this table and recorded in the ingest report.
- Every variant has exactly one source_ref; every imported product has ≥1.

## Formation notes

Written at emit alongside identity minting. On re-import, `raw_hash` comparison classifies each source record as unchanged / changed / new — only changed and new rows flow through the pipeline again, and published identities are preserved via the lock files.
