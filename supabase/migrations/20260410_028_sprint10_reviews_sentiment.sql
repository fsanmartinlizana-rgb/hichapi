-- ══════════════════════════════════════════════════════════════════════════════
-- Sprint 10: Post-order reviews with sentiment analysis
-- ══════════════════════════════════════════════════════════════════════════════
-- Adds:
--   • reviews.sentiment       — 'positive' | 'neutral' | 'negative'
--   • reviews.sentiment_score — -1.0 .. 1.0 (Haiku output)
--   • reviews.topics          — text[] (what the review mentions: service, food, ambiance, price, speed)
--   • reviews.ai_summary      — one-sentence Haiku summary the admin can scan
--   • Allow anonymous inserts of post_order reviews (service-role writes from API)
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS sentiment TEXT
    CHECK (sentiment IN ('positive', 'neutral', 'negative'));

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(3, 2)
    CHECK (sentiment_score >= -1 AND sentiment_score <= 1);

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS topics TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS ai_summary TEXT;

CREATE INDEX IF NOT EXISTS idx_reviews_sentiment
  ON reviews(restaurant_id, sentiment, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_order
  ON reviews(order_id)
  WHERE order_id IS NOT NULL;

-- Prevent duplicate post_order reviews per order
CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_order
  ON reviews(order_id)
  WHERE order_id IS NOT NULL AND source = 'post_order';

COMMENT ON COLUMN reviews.sentiment IS
  'Claude Haiku sentiment classification: positive / neutral / negative. Null if not yet analyzed.';

COMMENT ON COLUMN reviews.topics IS
  'Aspects mentioned by the reviewer — e.g. {service, food, ambiance, price, speed}. Used for per-topic breakdowns.';
