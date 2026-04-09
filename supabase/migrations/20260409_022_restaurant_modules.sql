-- Migration 022: Restaurant modules config + business type

-- 1. Safely update plan CHECK to include new values without losing existing data
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_plan_check;
ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_plan_check
  CHECK (plan IN ('free', 'discovery', 'at_table', 'starter', 'pro', 'enterprise'));

-- 2. Add business_type
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'restaurant'
    CHECK (business_type IN ('restaurant','cafe','bar','dark_kitchen','food_truck','bakery','other'));

-- 3. Add modules_config JSONB
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS modules_config JSONB NOT NULL DEFAULT '{
    "tables": true,
    "kitchen_display": true,
    "inventory": true,
    "cash_register": true,
    "loyalty": false,
    "waitlist": true,
    "daily_reports": false,
    "geofencing": false,
    "staff_schedule": false
  }'::jsonb;
