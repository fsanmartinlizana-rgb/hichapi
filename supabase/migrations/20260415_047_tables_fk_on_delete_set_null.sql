-- ════════════════════════════════════════════════════════════════════════════
-- 047 — Permitir eliminar mesas aunque tengan órdenes históricas
-- ════════════════════════════════════════════════════════════════════════════
-- Antes: borrar una mesa con órdenes pagadas/canceladas fallaba por FK.
-- Ahora: al borrar la mesa, orders.table_id queda NULL (se preserva la
-- historia de ventas) — aplica sólo al FK orders → tables.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  -- Buscar el nombre actual del FK orders.table_id → tables.id
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'public.orders'::regclass
    AND contype  = 'f'
    AND conkey   = (SELECT ARRAY[attnum]
                    FROM pg_attribute
                    WHERE attrelid = 'public.orders'::regclass
                      AND attname  = 'table_id')
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

-- Recrear con ON DELETE SET NULL
ALTER TABLE public.orders
  ADD CONSTRAINT orders_table_id_fkey
  FOREIGN KEY (table_id)
  REFERENCES public.tables(id)
  ON DELETE SET NULL;

-- Mismo tratamiento para waitlist_entries si existe con FK a tables
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'waitlist_entries') THEN
    SELECT conname INTO fk_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.waitlist_entries'::regclass
      AND c.contype  = 'f'
      AND a.attname  = 'seated_table_id'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.waitlist_entries DROP CONSTRAINT %I', fk_name);
      ALTER TABLE public.waitlist_entries
        ADD CONSTRAINT waitlist_entries_seated_table_id_fkey
        FOREIGN KEY (seated_table_id)
        REFERENCES public.tables(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

COMMENT ON CONSTRAINT orders_table_id_fkey ON public.orders IS
  'Al borrar una mesa, la orden histórica conserva la información pero libera el FK.';
