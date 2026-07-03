# `price`

## Purpose

Money rows per variant. Three kinds: `list` (what the customer pays now), `sale` (promotional price with optional validity window), `msrp` (strike-through reference). The source's `compare_at_price` is **MSRP in disguise** — 99.1% of records are permanently "on sale" `[verified]` — so it maps to `msrp`, and `source.variants[].price` maps to `list`. Genuine timed promotions are `sale` rows with `valid_from`/`valid_to`; the storefront picks the effective price as: valid `sale` if present, else `list`.

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `id` | `text` | no | — | PK | `price_` + hash | derived | `price_o2m1aa` |
| `variant_id` | `text` | no | — | FK → `variant.id` ON DELETE CASCADE | — | derived | `var_77qk2e` |
| `kind` | `price_kind` | no | — | — | `list` / `sale` / `msrp` | see above | `list` |
| `currency` | `char(3)` | no | `'USD'` | ISO-4217 | USD-only at launch (decision 5) | constant | `USD` |
| `amount_cents` | `integer` | no | — | CHECK `>= 0` | Integer cents, never floats | `source.variants[].price` × 100 (list); `compare_at_price` × 100 (msrp) | `10999` |
| `price_list_id` | `text` | yes | — | — | Future customer-group / regional price lists | n/a | — |
| `valid_from` | `timestamptz` | yes | — | — | Promo window start | n/a at import | — |
| `valid_to` | `timestamptz` | yes | — | CHECK `valid_to > valid_from` | Promo window end | n/a at import | — |
| `min_quantity` | `integer` | yes | — | CHECK `> 1` | Tiered pricing threshold | n/a at import | — |

## Indexes & uniques

- `UNIQUE (variant_id, kind, currency, coalesce(price_list_id,''), coalesce(min_quantity,1), coalesce(valid_from,'-infinity'))`.
- Index `(variant_id, kind, valid_to)` — effective-price lookup filters `valid_to IS NULL OR valid_to > now()` at query time (`now()` is not allowed in index predicates).

## Invariants

- Every variant of a non-`draft` product has ≥1 `list` row with `amount_cents > 0` in each supported currency.
- Where all three exist for one variant/currency: `sale < list ≤ msrp`.
- No `active` variant is priced 0 — the 10 zero-price source rows `[verified]` are classified `service`/`draft` with a `placeholder_price` flag instead.

## Formation notes

Prices arrive as decimal strings; the pipeline converts to integer cents with exact string math (no float parse). Price-band tags in the source (`[verified]`) are cross-checked against the actual list price at extraction — mismatches raise a review flag rather than trusting the tag.

## Open questions / confirm-locally

- Records where `compare_at_price ≤ price` (would invert `list ≤ msrp`) — drop the msrp row and flag `[confirm-locally: count]`.
