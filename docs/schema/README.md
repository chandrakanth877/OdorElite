# OdorElite Canonical Catalog Schema

Documentation for the canonical product-catalog schema that OdorElite (Next.js + MedusaJS + Neon Postgres) is built on. The schema is designed to hold **every e-commerce product shape** — master/variant, standalone, bundles/gift sets, services, warranties, gift cards, perpetual inventory — while carrying the fragrance-specific enrichment data from the labelleperfumes.com scrape (`enriched-products.jsonl`, 5,560 lines → 5,428 distinct products).

## Contents

| File | What it covers |
|---|---|
| [`er-diagram.md`](./er-diagram.md) | Entity-relationship diagram of all tables |
| [`enums.md`](./enums.md) | Every enum type: canonical values + source-spelling → canonical maps |
| [`tables/*.md`](./tables/) | One document per table, every column specified |
| [`source-data-reference.md`](./source-data-reference.md) | Field-by-field inventory of the source JSONL |
| [`source-to-schema-mapping.md`](./source-to-schema-mapping.md) | Matrix: every source field → table.column + transform |
| [`how-to-form-the-schema.md`](./how-to-form-the-schema.md) | Guide: source JSONL → canonical entities → DDL order |
| [`ddl/schema.sql`](./ddl/schema.sql) | Reference Postgres DDL matching the table docs |
| [`validation/`](./validation/) | Script to verify these docs against the real JSONL |

## Table index (dependency order)

1. [`brand`](./tables/brand.md) — canonical brands, accent-folded matching keys
2. [`category`](./tables/category.md) — storefront navigation tree
3. [`attribute_definition`](./tables/attribute-definition.md) — registry of product/variant attributes; declares which attributes *variate*
4. [`product`](./tables/product.md) — one row per PDP (master or standalone)
5. [`product_category`](./tables/product-category.md) — product ↔ category join
6. [`variant`](./tables/variant.md) — one row per buyable SKU
7. [`attribute_value`](./tables/attribute-value.md) — attribute values validated against the registry
8. [`price`](./tables/price.md) — list / sale / MSRP rows per variant
9. [`inventory_record`](./tables/inventory-record.md) — one per variant; policy-driven
10. [`media`](./tables/media.md) — images with roles (main, gallery, notes pyramid, …)
11. [`fragrance_profile`](./tables/fragrance-profile.md) — 1:0..1 typed fragrance data (not EAV)
12. [`product_relation`](./tables/product-relation.md) — similar / dupe_of / flanker_of / same_line links
13. [`bundle_item`](./tables/bundle-item.md) — gift-set composition (kind = bundle only)
14. [`source_ref`](./tables/source-ref.md) — provenance back to the scraped Shopify records
15. [`review_flag`](./tables/review-flag.md) — data-quality flags feeding the review queues

## Conventions

- **Primary keys** are `text`, deterministic, prefixed by entity (`prod_`, `var_`, `brand_`, …). IDs are minted from stable natural keys (hash of brand + normalized name + concentration + gender for products; source ids for provenance) so **re-running the import pipeline never changes a published ID, slug, or SKU**. Published identity values are pinned in lock files.
- **Money** is `integer` cents, never floats. Currency is ISO-4217 `char(3)`; USD-only at launch, multi-currency-ready (currency participates in price uniqueness).
- **Enums** are Postgres `CREATE TYPE ... AS ENUM`. Tradeoff: adding values needs `ALTER TYPE ... ADD VALUE` (cheap); removal/reorder needs a migration. Chosen over CHECK constraints for type safety in generated clients.
- **Timestamps** are `timestamptz`. Every table has `created_at`/`updated_at` defaulting to `now()`; they are omitted from the per-table column lists for brevity (pure join tables have `created_at` only).
- **Nullability policy**: `NULL` means *unknown or not applicable* — never `"N/A"` strings or empty-string sentinels. The import pipeline converts all `"N/A"` values from enrichment to `NULL` before insert.
- **Standalone products** are `kind = standard` with **exactly one variant** — the storefront renders one code path for standalone and multi-variant products alike.
- **Perpetual is an inventory policy, not a product kind** — a gift card is `product.kind = gift_card` whose variant has `inventory_record.policy = perpetual`.

## Claim tags

Data-derived statements in these docs are tagged:

- **`[verified]`** — measured directly against the source JSONL during the analysis session (e.g. "5,428 distinct `source.id` values").
- **`[confirm-locally]`** — a shape or exhaustive list that must be re-checked against the real `enriched-products.jsonl` (which lives outside this repo) before the import pipeline is finalized. Run `validation/validate-source-reference.mjs` against the real file to check every tagged claim.

## Source data (context)

Each JSONL line has a raw Shopify `source` block (`id`, `title`, `handle`, `vendor`, `product_type`, `tags[]`, `variants[]` with `price`/`compare_at_price`/`sku`/`available`, `images[]`) and a Gemini `enriched` block (43 fragrance fields). Key facts driving the schema `[verified]`:

- 5,560 lines → 5,428 distinct products (132 duplicate retry lines, 126 stale empty-enrichment lines; dedupe by `source.id` keeping the enriched line).
- **Each size is a separate source product** — master/variant structure is *derived* by normalization + fuzzy matching, not present in the source. ~341 implicit size-sibling groups (738 records).
- `compare_at_price` is MSRP (99.1% of records "on sale"); 83% `available:false`; 10 zero-price placeholder rows; 135 records with zero images; 4,092 enriched without web grounding.
- Tags encode attributes: `DUPE` (627 clones), `LIMIT1`–`LIMIT3` (purchase limits), price bands, `YGroup_*` (same-line grouping — *not* same-master).

## Decision log (carried from the planning analysis)

1. Out-of-stock products import **active with quantity 0** (notify-me UX; preserves the ~5k-page SEO surface).
2. EDP vs Parfum of the same name = **separate products** linked by `same_line` relations.
3. Testers = **variants of the parent product** (`is_tester` variating attribute), not separate products.
4. Skin & beauty and candles import as **draft** (fragrance-only launch).
5. USD-only pricing at launch; schema is multi-currency-ready.
