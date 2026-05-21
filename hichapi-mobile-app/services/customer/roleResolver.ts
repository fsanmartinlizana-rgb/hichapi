/**
 * Resuelve el rol de la app tras login: staff (Main), customer o none.
 */
import { supabase } from '../../config/supabase'

export type AppRole = 'staff' | 'customer' | 'none'

export async function resolveAppRole(userId: string): Promise<AppRole> {
  const [teamRes, customerRes] = await Promise.all([
    supabase
      .from('team_members')
      .select('id')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle(),
    supabase
      .from('customer_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (teamRes.data) return 'staff'
  if (customerRes.data) return 'customer'
  return 'none'
}
