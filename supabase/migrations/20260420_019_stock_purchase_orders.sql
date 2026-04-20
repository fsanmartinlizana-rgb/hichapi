-- Migration: 20260420_019_stock_purchase_orders
-- Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 3.4

-- 1. Create purchase_orders table
CREATE TABLE public.purchase_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'borrador'
                    CHECK (status IN ('borrador', 'enviada', 'recibida', 'cancelada')),
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  received_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create purchase_order_items table
CREATE TABLE public.purchase_order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  stock_item_id       UUID NOT NULL REFERENCES stock_items(id),
  qty_ordered         NUMERIC(10,3) NOT NULL CHECK (qty_ordered > 0),
  cost_per_unit       INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create purchase_invoices table
CREATE TABLE public.purchase_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  purchase_order_id   UUID NOT NULL REFERENCES purchase_orders(id),
  invoice_number      TEXT,
  total_amount        INTEGER NOT NULL DEFAULT 0,
  issued_at           DATE,
  due_at              DATE,
  paid_at             TIMESTAMPTZ,
  paid_amount         INTEGER,
  payment_status      TEXT NOT NULL DEFAULT 'pendiente'
                        CHECK (payment_status IN ('pendiente', 'pagada')),
  attachment_url      TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Add purchase_order_id column to stock_movements for traceability
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id);

-- 5. Drop constraint that prevents negative stock (Req 3.4: stock negativo permitido)
ALTER TABLE stock_items DROP CONSTRAINT IF EXISTS stock_items_current_qty_check;

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_orders_restaurant_status ON purchase_orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_order ON purchase_invoices(purchase_order_id);
