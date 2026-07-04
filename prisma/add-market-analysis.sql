DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MarketAnalysisSnapshotStatus') THEN
    CREATE TYPE "MarketAnalysisSnapshotStatus" AS ENUM ('processing', 'completed', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MarketAnalysisTrend') THEN
    CREATE TYPE "MarketAnalysisTrend" AS ENUM ('up', 'down', 'unchanged', 'unavailable');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS market_analysis_benchmarks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  product_offering_id TEXT NOT NULL UNIQUE REFERENCES product_offerings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market_analysis_benchmark_markets (
  benchmark_id TEXT NOT NULL REFERENCES market_analysis_benchmarks(id) ON DELETE CASCADE,
  market_id TEXT NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  PRIMARY KEY (benchmark_id, market_id)
);

CREATE TABLE IF NOT EXISTS market_analysis_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  analysis_date DATE NOT NULL UNIQUE,
  status "MarketAnalysisSnapshotStatus" NOT NULL DEFAULT 'processing',
  started_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP(3),
  error_message TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market_analysis_snapshot_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  snapshot_id TEXT NOT NULL REFERENCES market_analysis_snapshots(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_offering_id TEXT NOT NULL REFERENCES product_offerings(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  brand_name TEXT,
  package_name TEXT NOT NULL,
  current_price DECIMAL(12, 2),
  previous_price DECIMAL(12, 2),
  change_percentage DECIMAL(10, 2),
  trend "MarketAnalysisTrend" NOT NULL DEFAULT 'unavailable',
  currency TEXT NOT NULL DEFAULT 'NGN',
  observation_count INTEGER NOT NULL DEFAULT 0,
  last_price_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (snapshot_id, product_offering_id)
);

CREATE INDEX IF NOT EXISTS market_analysis_benchmarks_is_active_idx ON market_analysis_benchmarks(is_active);
CREATE INDEX IF NOT EXISTS market_analysis_benchmark_markets_market_id_idx ON market_analysis_benchmark_markets(market_id);
CREATE INDEX IF NOT EXISTS market_analysis_snapshots_status_date_idx ON market_analysis_snapshots(status, analysis_date);
CREATE INDEX IF NOT EXISTS market_analysis_snapshot_items_offering_id_idx ON market_analysis_snapshot_items(product_offering_id);
