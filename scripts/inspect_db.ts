import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://rtdryqujuywwaetzjxdo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0ZHJ5cXVqdXl3d2FldHpqeGRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI3NDA1NCwiZXhwIjoyMDkwODUwMDU0fQ.q4_DzWULHAODAwJOS5zuLDkW_PkBIlg29dV8KetyHKY'
)

async function main() {
  const { data, error } = await sb.rpc('inspect_table_columns', { table_name: 'delivery_orders' })
  if (error) {
    // If no inspect_table_columns RPC exists, try selecting one row
    const { data: row, error: rowError } = await sb.from('tables').select('id, label, status').eq('restaurant_id', '81b0c710-c7e7-44af-9ab2-9cf072924b71')
    if (rowError) {
      console.error('Error fetching tables:', rowError)
    } else {
      console.log('Tables for restaurant 81b0c710-c7e7-44af-9ab2-9cf072924b71:', row)
    }
  } else {
    console.log('Columns:', data)
  }
}

main()
