CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_sku_trgm_idx
  ON products USING gin (sku gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_description_trgm_idx
  ON products USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_name_sort_idx
  ON products (name);
