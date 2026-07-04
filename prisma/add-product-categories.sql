CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO product_categories (name, slug, sort_order)
VALUES
  ('Fruits', 'fruits', 10),
  ('Grains', 'grains', 20),
  ('Vegetables', 'vegetables', 30),
  ('Meat', 'meat', 40),
  ('Seafood', 'seafood', 50),
  ('Dairy', 'dairy', 60),
  ('Bakery', 'bakery', 70),
  ('Beverages', 'beverages', 80),
  ('Snacks', 'snacks', 90),
  ('Spices', 'spices', 100),
  ('Oils', 'oils', 110),
  ('Legumes', 'legumes', 120),
  ('Tubers', 'tubers', 130),
  ('Frozen Foods', 'frozen-foods', 140),
  ('Household', 'household', 150),
  ('Personal Care', 'personal-care', 160),
  ('Other', 'other', 170)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'category'
  ) THEN
    UPDATE products p
    SET category_id = pc.id
    FROM product_categories pc
    WHERE p.category_id IS NULL
      AND pc.slug = CASE p.category::text
        WHEN 'FrozenFoods' THEN 'frozen-foods'
        WHEN 'PersonalCare' THEN 'personal-care'
        ELSE lower(p.category::text)
      END;

    UPDATE products p
    SET category_id = pc.id
    FROM product_categories pc
    WHERE p.category_id IS NULL
      AND pc.name = p.category::text;
  END IF;
END $$;

UPDATE products p
SET category_id = pc.id
FROM product_categories pc
WHERE p.category_id IS NULL
  AND pc.slug = 'other';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM products WHERE category_id IS NULL) THEN
    RAISE EXCEPTION
      'Some products have no category mapping. Clear or assign them before completing this migration.';
  END IF;
END $$;

ALTER TABLE products
  ALTER COLUMN category_id SET NOT NULL;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE products
  ADD CONSTRAINT products_category_id_fkey
  FOREIGN KEY (category_id)
  REFERENCES product_categories(id)
  ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS products_category_id_idx
  ON products(category_id);
CREATE INDEX IF NOT EXISTS product_categories_is_active_sort_order_idx
  ON product_categories(is_active, sort_order);

ALTER TABLE products
  DROP COLUMN IF EXISTS category;

DROP TYPE IF EXISTS "ProductCategory";
