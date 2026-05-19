-- Add new document columns to rider_profiles
ALTER TABLE public.rider_profiles
  ADD COLUMN IF NOT EXISTS doc_permit_url text,
  ADD COLUMN IF NOT EXISTS doc_inspection_url text,
  ADD COLUMN IF NOT EXISTS doc_driver_record_url text;
