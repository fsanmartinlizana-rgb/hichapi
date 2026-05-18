-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 020: Rider Storage Bucket
-- Creates the private `rider-documents` Supabase Storage bucket and RLS policies.
--
-- Bucket convention:
--   Bucket name : rider-documents
--   Path pattern: {user_id}/{doc_type}.{ext}
--   Doc types   : national_id | license | insurance
--   Access      : private — only the rider (by user_id) and super_admin can read/write
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Create private storage bucket ─────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rider-documents',
  'rider-documents',
  false,                                                        -- private bucket
  10485760,                                                     -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. RLS policies for rider-documents bucket ────────────────────────────────

-- Riders can read their own documents; super_admin can read all
CREATE POLICY "rider_documents_rider_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'rider-documents'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (SELECT public.is_super_admin())
    )
  );

-- Riders can upload documents only into their own folder ({user_id}/...)
CREATE POLICY "rider_documents_rider_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'rider-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Riders can replace/update their own documents
CREATE POLICY "rider_documents_rider_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'rider-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
