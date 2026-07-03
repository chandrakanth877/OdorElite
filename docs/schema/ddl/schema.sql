-- OdorElite canonical catalog schema — reference DDL (Neon Postgres).
-- Matches docs/schema/tables/*.md; those docs are the source of truth for semantics.
-- Creation order: enums → brand/category/attribute_definition → product → variant → satellites.

BEGIN;

-- ---------- enum types ----------
CREATE TYPE gender            AS ENUM ('women','men','unisex','kids');
CREATE TYPE concentration     AS ENUM ('parfum','extrait','edp','edt','edc','cologne','eau_fraiche',
                                       'perfume_oil','attar','body_mist','body_spray','hair_mist',
                                       'deodorant','aftershave','candle','room_spray','other');
CREATE TYPE product_kind      AS ENUM ('standard','variant_master','bundle','service','warranty','gift_card');
CREATE TYPE item_category     AS ENUM ('fragrance','tester','gift_set','miniature','body_spray',
                                       'candle','skin_beauty','misc');
CREATE TYPE product_status    AS ENUM ('active','draft','archived');
CREATE TYPE price_kind        AS ENUM ('list','sale','msrp');
CREATE TYPE inventory_policy  AS ENUM ('tracked','perpetual','preorder','backorder');
CREATE TYPE media_role        AS ENUM ('main','gallery','swatch','notes_pyramid','lifestyle','packaging');
CREATE TYPE relation_type     AS ENUM ('similar','dupe_of','flanker_of','same_line','layering_partner');
CREATE TYPE attribute_type    AS ENUM ('text','number','boolean','enum');
CREATE TYPE attribute_scope   AS ENUM ('product','variant');
CREATE TYPE longevity         AS ENUM ('poor','weak','moderate','long_lasting','eternal');   -- [confirm-locally]
CREATE TYPE sillage           AS ENUM ('intimate','moderate','strong','enormous');           -- [confirm-locally]
CREATE TYPE flag_type         AS ENUM ('missing_image','zero_price','unmapped_value','grouping_ambiguous',
                                       'needs_re_enrichment','placeholder_price','name_anomaly');
CREATE TYPE flag_status       AS ENUM ('open','resolved');

-- ---------- brand ----------
CREATE TABLE brand (
    id           text PRIMARY KEY,
    slug         text NOT NULL UNIQUE,
    name         text NOT NULL,
    name_folded  text NOT NULL UNIQUE,
    aliases      text[] NOT NULL DEFAULT '{}',
    logo_url     text,
    description  text,
    website_url  text,
    status       product_status NOT NULL DEFAULT 'active',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX brand_aliases_gin ON brand USING gin (aliases);

-- ---------- category ----------
CREATE TABLE category (
    id              text PRIMARY KEY,
    slug            text NOT NULL UNIQUE,
    name            text NOT NULL,
    parent_id       text REFERENCES category(id),
    position        integer NOT NULL DEFAULT 0,
    description     text,
    seo_title       text CHECK (char_length(seo_title) <= 60),
    seo_description text CHECK (char_length(seo_description) <= 160),
    status          product_status NOT NULL DEFAULT 'active',
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (parent_id, name)
);
CREATE INDEX category_parent_idx ON category (parent_id);

-- ---------- attribute_definition ----------
CREATE TABLE attribute_definition (
    id           text PRIMARY KEY,
    code         text NOT NULL UNIQUE,
    label        text NOT NULL,
    type         attribute_type NOT NULL,
    scope        attribute_scope NOT NULL,
    is_variating boolean NOT NULL DEFAULT false,
    enum_values  text[],
    facetable    boolean NOT NULL DEFAULT false,
    unit         text,
    position     integer NOT NULL DEFAULT 0,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CHECK (NOT is_variating OR scope = 'variant'),
    CHECK ((type = 'enum') = (enum_values IS NOT NULL AND cardinality(enum_values) > 0))
);

-- ---------- product ----------
CREATE TABLE product (
    id                        text PRIMARY KEY,
    kind                      product_kind NOT NULL,
    item_category             item_category NOT NULL,
    slug                      text NOT NULL UNIQUE,
    brand_id                  text NOT NULL REFERENCES brand(id),
    title                     text NOT NULL,
    line_name                 text,
    gender                    gender,
    description               text,
    short_description         text,
    status                    product_status NOT NULL DEFAULT 'draft',
    variating_attribute_codes text[] NOT NULL DEFAULT '{}',
    seo_title                 text CHECK (char_length(seo_title) <= 60),
    seo_description           text CHECK (char_length(seo_description) <= 160),
    tags                      text[] NOT NULL DEFAULT '{}',
    published_at              timestamptz,
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_brand_idx    ON product (brand_id);
CREATE INDEX product_status_idx   ON product (status);
CREATE INDEX product_itemcat_idx  ON product (item_category);
CREATE INDEX product_tags_gin     ON product USING gin (tags);

-- ---------- product_category ----------
CREATE TABLE product_category (
    product_id  text NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    category_id text NOT NULL REFERENCES category(id) ON DELETE CASCADE,
    position    integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (product_id, category_id)
);
CREATE INDEX product_category_cat_idx ON product_category (category_id);

-- ---------- variant ----------
CREATE TABLE variant (
    id           text PRIMARY KEY,
    product_id   text NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    sku          text NOT NULL UNIQUE,
    title        text NOT NULL,
    position     integer NOT NULL DEFAULT 0,
    barcode      text,
    weight_grams integer,
    status       product_status NOT NULL DEFAULT 'active',
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX variant_product_idx ON variant (product_id, position);

-- ---------- attribute_value ----------
CREATE TABLE attribute_value (
    id                      text PRIMARY KEY,
    attribute_definition_id text NOT NULL REFERENCES attribute_definition(id),
    product_id              text REFERENCES product(id) ON DELETE CASCADE,
    variant_id              text REFERENCES variant(id) ON DELETE CASCADE,
    value_text              text,
    value_number            numeric,
    value_boolean           boolean,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(product_id, variant_id) = 1),
    CHECK (num_nonnulls(value_text, value_number, value_boolean) = 1)
);
CREATE UNIQUE INDEX attribute_value_variant_uq ON attribute_value (variant_id, attribute_definition_id)
    WHERE variant_id IS NOT NULL;
CREATE UNIQUE INDEX attribute_value_product_uq ON attribute_value (product_id, attribute_definition_id)
    WHERE product_id IS NOT NULL;
CREATE INDEX attribute_value_facet_text_idx ON attribute_value (attribute_definition_id, value_text);
CREATE INDEX attribute_value_facet_num_idx  ON attribute_value (attribute_definition_id, value_number);

-- ---------- price ----------
CREATE TABLE price (
    id            text PRIMARY KEY,
    variant_id    text NOT NULL REFERENCES variant(id) ON DELETE CASCADE,
    kind          price_kind NOT NULL,
    currency      char(3) NOT NULL DEFAULT 'USD',
    amount_cents  integer NOT NULL CHECK (amount_cents >= 0),
    price_list_id text,
    valid_from    timestamptz,
    valid_to      timestamptz,
    min_quantity  integer CHECK (min_quantity > 1),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);
CREATE UNIQUE INDEX price_uq ON price (variant_id, kind, currency,
    coalesce(price_list_id,''), coalesce(min_quantity,1), coalesce(valid_from,'-infinity'::timestamptz));
CREATE INDEX price_effective_idx ON price (variant_id, kind, valid_to);

-- ---------- inventory_record ----------
CREATE TABLE inventory_record (
    variant_id            text PRIMARY KEY REFERENCES variant(id) ON DELETE CASCADE,
    policy                inventory_policy NOT NULL DEFAULT 'tracked',
    quantity              integer CHECK (quantity >= 0),
    allow_backorder       boolean NOT NULL DEFAULT false,
    preorder_release_date date,
    purchase_limit        integer CHECK (purchase_limit > 0),
    low_stock_threshold   integer,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CHECK (policy <> 'perpetual' OR quantity IS NULL),
    CHECK (policy <> 'tracked'   OR quantity IS NOT NULL)
);
CREATE INDEX inventory_instock_idx ON inventory_record (variant_id)
    WHERE policy = 'tracked' AND quantity > 0;

-- ---------- media ----------
CREATE TABLE media (
    id         text PRIMARY KEY,
    product_id text REFERENCES product(id) ON DELETE CASCADE,
    variant_id text REFERENCES variant(id) ON DELETE CASCADE,
    role       media_role NOT NULL DEFAULT 'gallery',
    url        text NOT NULL,
    source_url text,
    alt        text,
    width      integer,
    height     integer,
    position   integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(product_id, variant_id) = 1)
);
CREATE UNIQUE INDEX media_one_main_per_product ON media (product_id)
    WHERE role = 'main' AND product_id IS NOT NULL;
CREATE INDEX media_product_idx ON media (product_id, position);

-- ---------- fragrance_profile ----------
CREATE TABLE fragrance_profile (
    product_id               text PRIMARY KEY REFERENCES product(id) ON DELETE CASCADE,
    concentration            concentration,
    family                   text,
    subfamily                text,
    notes_top                text[] NOT NULL DEFAULT '{}',
    notes_heart              text[] NOT NULL DEFAULT '{}',
    notes_base               text[] NOT NULL DEFAULT '{}',
    accords                  text[] NOT NULL DEFAULT '{}',
    perfumer                 text[] NOT NULL DEFAULT '{}',
    launch_year              smallint CHECK (launch_year BETWEEN 1900 AND 2100),
    longevity                longevity,
    sillage                  sillage,
    season_spring            numeric(3,2) CHECK (season_spring BETWEEN 0 AND 1),
    season_summer            numeric(3,2) CHECK (season_summer BETWEEN 0 AND 1),
    season_fall              numeric(3,2) CHECK (season_fall BETWEEN 0 AND 1),
    season_winter            numeric(3,2) CHECK (season_winter BETWEEN 0 AND 1),
    occasions                text[] NOT NULL DEFAULT '{}',
    oil_percentage           numeric(4,1) CHECK (oil_percentage BETWEEN 0 AND 100),
    awards                   text[] NOT NULL DEFAULT '{}',
    is_clone                 boolean NOT NULL DEFAULT false,
    clone_of_external        text,
    is_flanker               boolean NOT NULL DEFAULT false,
    parent_fragrance         text,
    enrichment_confidence    numeric(3,2) CHECK (enrichment_confidence BETWEEN 0 AND 1),
    enrichment_model         text,
    enrichment_web_grounded  boolean NOT NULL DEFAULT false,
    enriched_at              timestamptz,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fragrance_family_idx     ON fragrance_profile (family);
CREATE INDEX fragrance_notes_top_gin  ON fragrance_profile USING gin (notes_top);
CREATE INDEX fragrance_notes_hrt_gin  ON fragrance_profile USING gin (notes_heart);
CREATE INDEX fragrance_notes_base_gin ON fragrance_profile USING gin (notes_base);
CREATE INDEX fragrance_accords_gin    ON fragrance_profile USING gin (accords);

-- ---------- product_relation ----------
CREATE TABLE product_relation (
    id               text PRIMARY KEY,
    from_product_id  text NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    relation_type    relation_type NOT NULL,
    to_product_id    text REFERENCES product(id) ON DELETE CASCADE,
    to_external_name text,
    confidence       numeric(3,2) CHECK (confidence BETWEEN 0 AND 1),
    source           text NOT NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(to_product_id, to_external_name) = 1),
    CHECK (to_product_id IS NULL OR to_product_id <> from_product_id)
);
CREATE UNIQUE INDEX product_relation_uq ON product_relation
    (from_product_id, relation_type, coalesce(to_product_id,''), coalesce(to_external_name,''));
CREATE INDEX product_relation_to_idx ON product_relation (to_product_id);

-- ---------- bundle_item ----------
CREATE TABLE bundle_item (
    id                text PRIMARY KEY,
    bundle_product_id text NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    item_variant_id   text REFERENCES variant(id),
    item_description  text,
    quantity          integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    position          integer NOT NULL DEFAULT 0,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(item_variant_id, item_description) = 1)
);
CREATE INDEX bundle_item_bundle_idx ON bundle_item (bundle_product_id, position);

-- ---------- source_ref ----------
CREATE TABLE source_ref (
    id                text PRIMARY KEY,
    product_id        text REFERENCES product(id) ON DELETE CASCADE,
    variant_id        text REFERENCES variant(id) ON DELETE CASCADE,
    source_platform   text NOT NULL DEFAULT 'shopify',
    source_store      text NOT NULL DEFAULT 'labelleperfumes.com',
    source_product_id bigint NOT NULL,
    source_variant_id bigint,
    source_handle     text,
    sku_raw           text,
    title_raw         text,
    raw_hash          text NOT NULL,
    imported_at       timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(product_id, variant_id) >= 1)
);
CREATE UNIQUE INDEX source_ref_uq ON source_ref
    (source_platform, source_store, source_product_id, coalesce(source_variant_id, 0));
CREATE INDEX source_ref_product_idx ON source_ref (product_id);
CREATE INDEX source_ref_variant_idx ON source_ref (variant_id);

-- ---------- review_flag ----------
CREATE TABLE review_flag (
    id          text PRIMARY KEY,
    product_id  text REFERENCES product(id) ON DELETE CASCADE,
    variant_id  text REFERENCES variant(id) ON DELETE CASCADE,
    flag_type   flag_type NOT NULL,
    detail      jsonb,
    status      flag_status NOT NULL DEFAULT 'open',
    resolved_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(product_id, variant_id) = 1),
    CHECK ((status = 'resolved') = (resolved_at IS NOT NULL))
);
CREATE UNIQUE INDEX review_flag_open_uq ON review_flag
    (coalesce(product_id,''), coalesce(variant_id,''), flag_type) WHERE status = 'open';
CREATE INDEX review_flag_queue_idx ON review_flag (flag_type, status);

COMMIT;
