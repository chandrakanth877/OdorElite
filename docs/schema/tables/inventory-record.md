# `inventory_record`

## Purpose

Exactly one row per variant describing *how* availability works (`policy`) and, when tracked, *how much* stock exists. Perpetual availability (gift cards, services) is expressed here — **not** as a product kind — so the same product model covers digital and physical goods. 83% of source records are `available: false` `[verified]`; per decision 1 they import as tracked with `quantity = 0` and stay `active` (notify-me UX, preserves SEO surface).

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `variant_id` | `text` | no | — | PK, FK → `variant.id` ON DELETE CASCADE | 1:1 with variant | derived | `var_77qk2e` |
| `policy` | `inventory_policy` | no | `'tracked'` | — | `tracked` / `perpetual` / `preorder` / `backorder` | derived: `perpetual` for service/gift_card kinds, else `tracked` | `tracked` |
| `quantity` | `integer` | yes | — | CHECK `quantity >= 0`; CHECK `policy <> 'perpetual' OR quantity IS NULL` | On-hand stock; null when not tracked | `source.variants[].available`: true → seed quantity `[confirm-locally: Shopify exposes boolean only, seed value TBD]`, false → `0` | `0` |
| `allow_backorder` | `boolean` | no | `false` | — | Sell below zero | derived: true iff policy=backorder | `false` |
| `preorder_release_date` | `date` | yes | — | required iff policy=preorder (validator) | Expected ship date | n/a at import | — |
| `purchase_limit` | `integer` | yes | — | CHECK `> 0` | Max units per order | `LIMIT1`–`LIMIT3` source tags `[verified]` | `1` |
| `low_stock_threshold` | `integer` | yes | — | — | Storefront "only N left" trigger | curated default later | — |

## Indexes & uniques

- PK is the FK (`variant_id`) — enforces the 1:1.
- Partial index on `quantity` where `policy = 'tracked' AND quantity > 0` (in-stock filtering).

## Invariants

- `policy = 'perpetual'` ⇒ `quantity IS NULL`.
- `policy = 'tracked'` ⇒ `quantity IS NOT NULL`.
- `policy = 'preorder'` ⇒ `preorder_release_date IS NOT NULL`.
- Purchase-limit values only 1–3 from source tags; anything else is a review flag.

## Formation notes

`available: true` records need a real opening quantity from the merchant (Shopify's public JSON exposes only the boolean) — the import seeds a conservative placeholder and flags `needs_re_enrichment`-style review until actual counts are loaded `[confirm-locally]`. `LIMITn` tags are extracted before residual tags are stored on the product.
