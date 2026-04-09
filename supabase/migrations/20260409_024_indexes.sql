-- Migration 024: Performance indexes (CONCURRENTLY safe for production)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_restaurant_created
  ON public.orders(restaurant_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_payment_method
  ON public.orders(restaurant_id, payment_method);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_sessions_restaurant
  ON public.cash_register_sessions(restaurant_id, opened_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_imports_restaurant
  ON public.inventory_imports(restaurant_id, created_at DESC);
