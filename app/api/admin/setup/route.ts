/**
 * GET /api/admin/setup?secret=XXX
 * Crea la tabla restaurant_submissions si no existe.
 * Solo se llama una vez después del primer deploy.
 */
import { NextRequest, NextResponse } from 'next/server'

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'chapi-admin-2024'
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sql = `
    CREATE TABLE IF NOT EXISTS restaurant_submissions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name            TEXT NOT NULL,
      slug_proposed   TEXT,
      address         TEXT NOT NULL,
      neighborhood    TEXT NOT NULL,
      cuisine_type    TEXT NOT NULL,
      price_range     TEXT NOT NULL CHECK (price_range IN ('economico', 'medio', 'premium')),
      description     TEXT,
      instagram_url   TEXT,
      owner_name      TEXT NOT NULL,
      owner_email     TEXT NOT NULL,
      owner_phone     TEXT,
      status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),
      notes           TEXT,
      created_at      TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE restaurant_submissions ENABLE ROW LEVEL SECURITY;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'restaurant_submissions'
        AND policyname = 'public_insert_submissions'
      ) THEN
        CREATE POLICY "public_insert_submissions"
          ON restaurant_submissions FOR INSERT WITH CHECK (true);
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS submissions_status_idx
      ON restaurant_submissions (status, created_at DESC);
  `

  // Use Supabase's SQL API via pg_meta (available with service role)
  const res = await fetch(`${SB_URL}/rest/v1/rpc/query`, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!res.ok) {
    // Fallback: try inserting a dummy row to check if table exists
    const checkRes = await fetch(`${SB_URL}/rest/v1/restaurant_submissions?limit=1`, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
      },
    })

    if (checkRes.ok) {
      return NextResponse.json({ status: 'table already exists' })
    }

    return NextResponse.json({
      status: 'needs_manual_migration',
      message: 'Please run supabase/migrations/004_restaurant_submissions.sql in your Supabase SQL Editor',
      url: 'https://supabase.com/dashboard/project/rtdryqujuywwaetzjxdo/sql/new',
    }, { status: 200 })
  }

  return NextResponse.json({ status: 'ok', message: 'Table created successfully' })
}
