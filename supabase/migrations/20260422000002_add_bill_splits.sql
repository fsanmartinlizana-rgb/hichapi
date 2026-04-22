-- Migration: Add bill splits functionality
-- Description: Tables for managing bill splitting and payments per split

-- ============================================================================
-- Table: bill_splits
-- Purpose: Track bill splitting sessions for tables
-- ============================================================================

CREATE TABLE bill_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  
  -- Metadata
  order_ids UUID[] NOT NULL, -- IDs de las comandas incluidas
  total_amount INTEGER NOT NULL, -- Total en centavos
  split_type TEXT NOT NULL CHECK (split_type IN ('full', 'equal', 'by_items', 'custom')),
  
  -- Configuración de división
  split_config JSONB NOT NULL DEFAULT '{}',
  -- Ejemplos:
  -- full: {}
  -- equal: { "num_people": 4 }
  -- by_items: { "assignments": { "item_id": "person_1", ... } }
  -- custom: { "amounts": [10000, 15000, 20000] }
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'completed', 'cancelled')),
  num_splits INTEGER NOT NULL, -- Número total de divisiones
  num_paid INTEGER NOT NULL DEFAULT 0, -- Número de divisiones pagadas
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT bill_splits_num_splits_positive CHECK (num_splits > 0),
  CONSTRAINT bill_splits_num_paid_valid CHECK (num_paid >= 0 AND num_paid <= num_splits),
  CONSTRAINT bill_splits_total_positive CHECK (total_amount > 0)
);

-- Índices para bill_splits
CREATE INDEX idx_bill_splits_restaurant ON bill_splits(restaurant_id);
CREATE INDEX idx_bill_splits_table ON bill_splits(table_id);
CREATE INDEX idx_bill_splits_status ON bill_splits(status);
CREATE INDEX idx_bill_splits_created_at ON bill_splits(created_at DESC);

-- ============================================================================
-- Table: bill_split_payments
-- Purpose: Track individual payments within a bill split
-- ============================================================================

CREATE TABLE bill_split_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_split_id UUID NOT NULL REFERENCES bill_splits(id) ON DELETE CASCADE,
  
  -- Identificación
  split_index INTEGER NOT NULL, -- 0, 1, 2... (orden de la división)
  amount INTEGER NOT NULL, -- Monto en centavos
  
  -- Pago
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'digital', 'mixed')),
  cash_amount INTEGER NOT NULL DEFAULT 0,
  digital_amount INTEGER NOT NULL DEFAULT 0,
  
  -- DTE
  dte_type INTEGER CHECK (dte_type IN (33, 39)), -- 33=Factura, 39=Boleta
  dte_folio INTEGER,
  dte_xml TEXT,
  dte_status TEXT CHECK (dte_status IN ('pending', 'accepted', 'rejected', 'error')),
  dte_receptor JSONB, -- Datos del receptor si es factura
  
  -- Timestamps
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT bill_split_payments_amount_positive CHECK (amount > 0),
  CONSTRAINT bill_split_payments_split_index_valid CHECK (split_index >= 0),
  CONSTRAINT bill_split_payments_cash_valid CHECK (cash_amount >= 0),
  CONSTRAINT bill_split_payments_digital_valid CHECK (digital_amount >= 0),
  CONSTRAINT bill_split_payments_amounts_match CHECK (cash_amount + digital_amount = amount)
);

-- Índices para bill_split_payments
CREATE INDEX idx_bill_split_payments_bill_split ON bill_split_payments(bill_split_id);
CREATE INDEX idx_bill_split_payments_paid_at ON bill_split_payments(paid_at DESC);

-- Índice único para prevenir doble pago de misma división
CREATE UNIQUE INDEX idx_bill_split_payments_unique ON bill_split_payments(bill_split_id, split_index);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE bill_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_split_payments ENABLE ROW LEVEL SECURITY;

-- Policies for bill_splits
CREATE POLICY "Users can view bill_splits from their restaurant"
  ON bill_splits FOR SELECT
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM team_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert bill_splits for their restaurant"
  ON bill_splits FOR INSERT
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM team_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update bill_splits from their restaurant"
  ON bill_splits FOR UPDATE
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM team_members
      WHERE user_id = auth.uid()
    )
  );

-- Policies for bill_split_payments
CREATE POLICY "Users can view bill_split_payments from their restaurant"
  ON bill_split_payments FOR SELECT
  USING (
    bill_split_id IN (
      SELECT id FROM bill_splits
      WHERE restaurant_id IN (
        SELECT restaurant_id FROM team_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert bill_split_payments for their restaurant"
  ON bill_split_payments FOR INSERT
  WITH CHECK (
    bill_split_id IN (
      SELECT id FROM bill_splits
      WHERE restaurant_id IN (
        SELECT restaurant_id FROM team_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update bill_split_payments from their restaurant"
  ON bill_split_payments FOR UPDATE
  USING (
    bill_split_id IN (
      SELECT id FROM bill_splits
      WHERE restaurant_id IN (
        SELECT restaurant_id FROM team_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE bill_splits IS 'Tracks bill splitting sessions for restaurant tables';
COMMENT ON TABLE bill_split_payments IS 'Individual payments within a bill split';

COMMENT ON COLUMN bill_splits.split_type IS 'Type of split: full (one payment), equal (divide equally), by_items (assign items to people), custom (manual amounts)';
COMMENT ON COLUMN bill_splits.split_config IS 'Configuration specific to split_type';
COMMENT ON COLUMN bill_splits.status IS 'Status: pending (no payments), partial (some paid), completed (all paid), cancelled';

COMMENT ON COLUMN bill_split_payments.split_index IS 'Zero-based index of this payment within the split (0, 1, 2...)';
COMMENT ON COLUMN bill_split_payments.dte_receptor IS 'Receptor data for factura (document_type 33)';
