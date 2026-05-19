import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://rtdryqujuywwaetzjxdo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0ZHJ5cXVqdXl3d2FldHpqeGRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI3NDA1NCwiZXhwIjoyMDkwODUwMDU0fQ.q4_DzWULHAODAwJOS5zuLDkW_PkBIlg29dV8KetyHKY'
)

async function main() {
  // Try inserting an order with table_id = null
  const { data, error } = await sb
    .from('orders')
    .insert({
      restaurant_id: '81b0c710-c7e7-44af-9ab2-9cf072924b71', // Quezdapia
      status: 'pending',
      subtotal: 1000,
      total: 1000,
      client_name: 'Test Online',
      notes: 'Testing online order'
    })
    .select()
  
  if (error) {
    console.error('Failed to insert order with null table_id:', error)
  } else {
    console.log('Successfully inserted order with null table_id:', data)
    // Clean up
    await sb.from('orders').delete().eq('id', data[0].id)
  }
}

main()
