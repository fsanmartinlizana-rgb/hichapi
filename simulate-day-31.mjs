import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Faltan variables de entorno SUPABASE_URL o SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function simulateDay31() {
  console.log("1. Modificando restaurantes en 'trialing' para que el trial haya vencido ayer...");
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const { data: updated, error } = await supabase
    .from('restaurants')
    .update({ trial_ends_at: yesterday.toISOString() })
    .eq('subscription_status', 'trialing')
    .select('id, name, trial_ends_at');

  if (error) {
    console.error("Error actualizando restaurantes:", error);
    return;
  }

  console.log(`Se actualizaron ${updated.length} restaurantes:`, updated.map(r => r.name));

  if (updated.length === 0) {
    console.log("No hay restaurantes en estado 'trialing'. Primero inicia el piloto de 30 días en la app.");
    return;
  }

  console.log("\n2. Simulando la ejecución del Vercel Cron de facturación...");
  
  try {
    const res = await fetch('http://localhost:3000/api/cron/billing', {
      method: 'GET',
      headers: {
        // En .env.local probablemente no tienes CRON_SECRET, así que pasará directo
        ...(process.env.CRON_SECRET ? { 'Authorization': `Bearer ${process.env.CRON_SECRET}` } : {})
      }
    });

    const result = await res.json();
    console.log("Respuesta del Cron:", result);
    
    if (result.billed && result.billed.length > 0) {
      console.log("\n✅ ¡Éxito! El cron detectó el vencimiento, calculó el 1% de comisiones y creó la factura.");
      console.log("Revisa la tabla 'invoices' en Supabase y actualiza tu panel (deberías ver la pantalla roja de Bloqueo).");
    } else {
      console.log("\n⚠ El cron se ejecutó pero no facturó a nadie. Revisa si había 'orders' válidas en los últimos 30 días.");
    }
    
  } catch (err) {
    console.error("Error llamando al endpoint del cron. Asegúrate de que el servidor localhost:3000 esté corriendo:", err);
  }
}

simulateDay31();
