# `review_flag`

## Purpose

Machine-raised data-quality flags on products/variants — the persistent form of the pipeline's review queues. Flags gate invariants (an `active` product without a main image is legal *only* while its `missing_image` flag is open) and drive the operational to-do lists: re-enrichment (~4,092 non-grounded records `[verified]`), missing images (135 `[verified]`), ambiguous grouping, zero-price placeholders (10 `[verified]`).

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `id` | `text` | no | — | PK | `flag_` + hash(owner, type) | derived | `flag_m1x0aa` |
| `product_id` | `text` | yes | — | FK → `product.id` ON DELETE CASCADE | Flag target | derived | `prod_a8c1q0` |
| `variant_id` | `text` | yes | — | FK → `variant.id` ON DELETE CASCADE | Flag target (variant-level) | derived | — |
| `flag_type` | `flag_type` | no | — | — | See [`enums.md`](../enums.md) | pipeline stage that raised it | `needs_re_enrichment` |
| `detail` | `jsonb` | yes | — | — | Stage-specific payload (e.g. unmapped value, candidate merge pair + score, priority rank) | derived | `{"reason":"no_web_grounding","priority":2}` |
| `status` | `flag_status` | no | `'open'` | — | `open` / `resolved` | — | `open` |
| `resolved_at` | `timestamptz` | yes | — | — | — | — | — |

CHECK: exactly one of (`product_id`, `variant_id`) is non-null. CHECK: `status = 'resolved'` ⇔ `resolved_at IS NOT NULL`.

## Indexes & uniques

- `UNIQUE (coalesce(product_id,''), coalesce(variant_id,''), flag_type) WHERE status = 'open'` — no duplicate open flags.
- Index `(flag_type, status)` — queue queries.

## Invariants

- Expected open-flag counts after initial import: `missing_image` = 135, `placeholder_price` = 10, `needs_re_enrichment` ≈ 4,092 `[verified counts; confirm-locally after import]`.
- Every invariant *exception* elsewhere in the schema (imageless active product, unpriced draft) is covered by an open flag — the validator cross-checks.

## Formation notes

Raised throughout the pipeline: normalization (`unmapped_value`), grouping (`grouping_ambiguous` — mirrors the grouping review queue with candidate + score in `detail`), pricing (`zero_price`, `placeholder_price`), media (`missing_image`), enrichment audit (`needs_re_enrichment`, prioritized: missing brand/name first, then null perfumer/launch_year/notes on in-stock items). Resolving a flag (human or re-enrichment round-trip) sets `status`/`resolved_at`; the pipeline never re-opens a resolved flag for the same unchanged source data (`source_ref.raw_hash`).
