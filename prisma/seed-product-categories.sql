INSERT INTO product_categories (
  id,
  name,
  slug,
  description,
  is_active,
  sort_order,
  created_at,
  updated_at
)
VALUES
  (gen_random_uuid()::text, 'Fruits', 'fruits', 'Fresh and packaged fruits.', TRUE, 10, NOW(), NOW()),
  (gen_random_uuid()::text, 'Grains', 'grains', 'Rice, maize, wheat, millet and related grains.', TRUE, 20, NOW(), NOW()),
  (gen_random_uuid()::text, 'Vegetables', 'vegetables', 'Fresh leafy, root and fruit vegetables.', TRUE, 30, NOW(), NOW()),
  (gen_random_uuid()::text, 'Meat', 'meat', 'Fresh, frozen and processed meat products.', TRUE, 40, NOW(), NOW()),
  (gen_random_uuid()::text, 'Seafood', 'seafood', 'Fish, shellfish and other seafood products.', TRUE, 50, NOW(), NOW()),
  (gen_random_uuid()::text, 'Dairy', 'dairy', 'Milk, cheese, butter, yoghurt and related products.', TRUE, 60, NOW(), NOW()),
  (gen_random_uuid()::text, 'Bakery', 'bakery', 'Bread, flour-based foods and baked products.', TRUE, 70, NOW(), NOW()),
  (gen_random_uuid()::text, 'Beverages', 'beverages', 'Water, drinks, tea, coffee and other beverages.', TRUE, 80, NOW(), NOW()),
  (gen_random_uuid()::text, 'Snacks', 'snacks', 'Packaged and freshly prepared snack foods.', TRUE, 90, NOW(), NOW()),
  (gen_random_uuid()::text, 'Spices', 'spices', 'Seasonings, herbs and cooking spices.', TRUE, 100, NOW(), NOW()),
  (gen_random_uuid()::text, 'Oils', 'oils', 'Cooking oils, palm oil and related fats.', TRUE, 110, NOW(), NOW()),
  (gen_random_uuid()::text, 'Legumes', 'legumes', 'Beans, peas, lentils, groundnuts and related products.', TRUE, 120, NOW(), NOW()),
  (gen_random_uuid()::text, 'Tubers', 'tubers', 'Yam, cassava, potatoes and related root crops.', TRUE, 130, NOW(), NOW()),
  (gen_random_uuid()::text, 'Frozen Foods', 'frozen-foods', 'Frozen foods and temperature-controlled products.', TRUE, 140, NOW(), NOW()),
  (gen_random_uuid()::text, 'Household', 'household', 'Household supplies and everyday home products.', TRUE, 150, NOW(), NOW()),
  (gen_random_uuid()::text, 'Personal Care', 'personal-care', 'Personal hygiene, beauty and care products.', TRUE, 160, NOW(), NOW()),
  (gen_random_uuid()::text, 'Other', 'other', 'Products that do not fit another active category.', TRUE, 170, NOW(), NOW())
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = TRUE,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
