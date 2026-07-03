# Entity-Relationship Diagram

Cardinality legend: `||` exactly one · `o|` zero or one · `|{` one or more · `o{` zero or more.

```mermaid
erDiagram
    brand ||--o{ product : "brand_id"
    category ||--o{ category : "parent_id (tree)"
    category ||--o{ product_category : ""
    product ||--o{ product_category : ""
    product ||--|{ variant : "1..n (standard = exactly 1)"
    product ||--o| fragrance_profile : "0..1 (fragrance kinds)"
    product ||--o{ product_relation : "from_product_id"
    product ||--o{ media : "product-scoped"
    variant ||--o{ media : "variant-scoped"
    product ||--o{ bundle_item : "kind = bundle only"
    variant ||--o{ bundle_item : "component (or external desc)"
    variant ||--|{ price : "≥1 list (unless draft)"
    variant ||--|| inventory_record : "1:1"
    attribute_definition ||--o{ attribute_value : "validates"
    product ||--o{ attribute_value : "product-scoped"
    variant ||--o{ attribute_value : "variant-scoped"
    product ||--o{ source_ref : "provenance (1 per merged source record)"
    variant ||--o| source_ref : "provenance"
    product ||--o{ review_flag : ""
    variant ||--o{ review_flag : ""

    product {
        text id PK
        product_kind kind
        item_category item_category
        text slug UK
        text brand_id FK
        gender gender
        product_status status
        text_arr variating_attribute_codes
    }
    variant {
        text id PK
        text product_id FK
        text sku UK
        text title
        int position
    }
    price {
        text variant_id FK
        price_kind kind
        char3 currency
        int amount_cents
        timestamptz valid_from
    }
    inventory_record {
        text variant_id PK
        inventory_policy policy
        int quantity
        int purchase_limit
    }
    fragrance_profile {
        text product_id PK
        concentration concentration
        text family
        text_arr notes_top
        bool enrichment_web_grounded
    }
    product_relation {
        text from_product_id FK
        relation_type relation_type
        text to_product_id FK
        text to_external_name
    }
```

## Reading the shape

- **Commerce spine**: `brand → product → variant → price / inventory_record`. Everything buyable is a variant; everything browsable is a product.
- **Variation is declared, not implied**: `attribute_definition` (registry) → `attribute_value` (values). A master's `variating_attribute_codes` says which attribute tuples distinguish its variants.
- **The fragrance vertical is a typed satellite**: `fragrance_profile` hangs 1:0..1 off product; facetable fields are mirrored into `attribute_value` at emit.
- **Graph layer**: `product_relation` links products to each other and to external fragrance names (`dupe_of` targets, `similar` references).
- **Operational layer**: `source_ref` (provenance/idempotency) and `review_flag` (quality queues) — no storefront reads, pipeline reads/writes.
