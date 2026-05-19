import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://rtdryqujuywwaetzjxdo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0ZHJ5cXVqdXl3d2FldHpqeGRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI3NDA1NCwiZXhwIjoyMDkwODUwMDU0fQ.q4_DzWULHAODAwJOS5zuLDkW_PkBIlg29dV8KetyHKY'
)

async function main() {
  const { data } = await sb
    .from('restaurants')
    .select('name, slug, active, claimed, owner_id')
    .order('created_at', { ascending: false })
    .limit(15)

  console.table(
    data?.map(r => ({
      name:      r.name,
      slug:      r.slug,
      url:       `http://localhost:3000/r/${r.slug}`,
      active:    r.active,
      claimed:   r.claimed,
      has_owner: !!r.owner_id,
    }))
  )
}

main()

