-- Migración para añadir campos de Flow.cl a la tabla restaurants

ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS flow_customer_id text,
ADD COLUMN IF NOT EXISTS flow_subscription_id text;

-- Índice para búsquedas rápidas si implementamos webhooks de suscripciones en el futuro
CREATE INDEX IF NOT EXISTS idx_restaurants_flow_customer_id ON public.restaurants(flow_customer_id);
