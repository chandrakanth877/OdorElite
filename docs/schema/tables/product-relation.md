# `product_relation`

## Purpose

Directed, typed edges between products — and to *external* fragrance names not carried in the catalog (clones' targets, similar-to references). Powers "inspired by", "more from this line", flanker navigation, and recommendation seeds.

## Columns

| Column | Type | Null | Default | Constraints | Description | Source mapping | Example |
|---|---|---|---|---|---|---|---|
| `id` | `text` | no | — | PK | `rel_` + hash(from, type, to) | derived | `rel_p0aa2m` |
| `from_product_id` | `text` | no | — | FK → `product.id` ON DELETE CASCADE | Edge source | derived | `prod_dupe1` |
| `relation_type` | `relation_type` | no | — | — | `similar` / `dupe_of` / `flanker_of` / `same_line` / `layering_partner` | see formation | `dupe_of` |
| `to_product_id` | `text` | yes | — | FK → `product.id` ON DELETE CASCADE | Target when in catalog | derived: fuzzy resolve | — |
| `to_external_name` | `text` | yes | — | — | Target when **not** in catalog | `enriched.similar_fragrances` / inspired-by | `Baccarat Rouge 540` |
| `confidence` | `numeric(3,2)` | yes | — | CHECK 0–1 | Fuzzy-match score for derived edges | derived | `0.94` |
| `source` | `text` | no | — | — | Provenance: `ygroup` / `tag` / `enrichment` / `derived` / `manual` | — | `tag` |

CHECK: exactly one of (`to_product_id`, `to_external_name`) is non-null. CHECK: `to_product_id <> from_product_id`.

## Indexes & uniques

- `UNIQUE (from_product_id, relation_type, coalesce(to_product_id,''), coalesce(to_external_name,''))`.
- Index `(to_product_id)` for reverse lookups ("dupes of this").

## Invariants

- All `to_product_id` values resolve.
- `same_line` edges are symmetric (both directions present) — pipeline emits pairs; validator checks.
- `dupe_of` sources: every product with the `DUPE` tag (627 `[verified]`) has exactly one `dupe_of` edge (external allowed) or an open review flag.

## Formation notes

- `YGroup_*` tags → `same_line` edges among group members (never merges — groups mix concentrations/genders `[verified]`).
- EDP vs Parfum splits (decision 2) → `same_line` between the two masters.
- `DUPE` tag + enrichment inspired-by → `dupe_of`, target resolved into the catalog by fuzzy name match ≥ 0.90, else `to_external_name`.
- `enriched.similar_fragrances` → `similar` edges with the same resolve-else-external rule.
- Name analysis (shared line prefix + pillar detection) → `flanker_of` (e.g. Acqua di Giò Profondo → Acqua di Giò).
