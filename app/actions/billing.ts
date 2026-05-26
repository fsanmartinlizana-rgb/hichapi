'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function startFreeTrial(restaurantId: string, targetPlan: string) {
  try {
    const supabase = createAdminClient()

    // 1. Validar restaurante
    const { data: restaurant, error: fetchErr } = await supabase
      .from('restaurants')
      .select('id, plan, subscription_status')
      .eq('id', restaurantId)
      .single()

    if (fetchErr || !restaurant) {
      return { success: false, error: 'Restaurante no encontrado' }
    }

    if (restaurant.subscription_status === 'active' && restaurant.plan !== 'free') {
      return { success: false, error: 'Ya tienes un plan activo' }
    }

    // 2. Calcular 30 días de prueba
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 30)

    // 3. Actualizar la base de datos
    const { error: updateErr } = await supabase
      .from('restaurants')
      .update({
        plan: targetPlan,
        subscription_status: 'trialing',
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .eq('id', restaurantId)

    if (updateErr) {
      console.error('Error starting trial:', updateErr)
      return { success: false, error: 'Error al activar el plan de prueba' }
    }

    revalidatePath('/modulos')
    return { success: true }
  } catch (err) {
    console.error('startFreeTrial error:', err)
    return { success: false, error: 'Ocurrió un error inesperado' }
  }
}

export async function getPendingInvoice(restaurantId: string) {
  try {
    const supabase = createAdminClient()
    const { data: invoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return { invoice }
  } catch {
    return { invoice: null }
  }
}
