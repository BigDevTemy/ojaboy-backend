CREATE TABLE IF NOT EXISTS wishlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Wishlist',
  order_id TEXT UNIQUE REFERENCES orders(id) ON DELETE SET NULL,
  converted_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id TEXT PRIMARY KEY,
  wishlist_id TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity DECIMAL(12, 2) NOT NULL,
  unit "PriceUnit" NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT wishlist_items_wishlist_product_unit_key
    UNIQUE (wishlist_id, product_id, unit)
);

CREATE INDEX IF NOT EXISTS wishlists_user_id_idx ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS wishlists_converted_at_idx ON wishlists(converted_at);
CREATE INDEX IF NOT EXISTS wishlist_items_wishlist_id_idx
  ON wishlist_items(wishlist_id);
CREATE INDEX IF NOT EXISTS wishlist_items_product_id_idx
  ON wishlist_items(product_id);
