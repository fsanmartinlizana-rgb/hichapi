import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const restaurant_id = 'a42f4ab8-9868-41e7-a4e2-eaf34d7786a0';

  const { data: existingStock } = await supabase
    .from('stock_items')
    .select('id, name')
    .eq('restaurant_id', restaurant_id);

  const stockMap = new Map<string, string>();
  for (const s of existingStock || []) {
    stockMap.set(s.name.trim().toLowerCase(), s.id);
  }

  const rawRecipe = "Lomo liso (kg): 0.25, Huevo (unidad): 2, Papas (kg): 0.3";
  const missingIngredients = new Map<string, string>();
  const ingredients: any[] = [];

  const parts = rawRecipe.split(/[,|]/);
  for (const p of parts) {
    if (!p.includes(':')) continue;
    const [nRaw, qRaw] = p.split(':');
    let n = nRaw.trim();
    let unit = 'unidad';

    const unitMatch = n.match(/[\(\[]([a-zA-Z]+)[\)\]]$/);
    if (unitMatch) {
      unit = unitMatch[1].toLowerCase();
      n = n.replace(/[\(\[][a-zA-Z]+[\)\]]$/, '').trim();
    }
    const q = parseFloat(qRaw);
    if (n && !isNaN(q) && q > 0) {
      ingredients.push({ name: n, qty: q });
      if (!stockMap.has(n.toLowerCase())) {
        missingIngredients.set(n, unit);
      }
    }
  }

  console.log('Ingredients parsed:', ingredients);
  console.log('Missing ingredients:', Array.from(missingIngredients.entries()));

  if (missingIngredients.size > 0) {
    const newStockRows = Array.from(missingIngredients.entries()).map(([name, unit]) => ({
      restaurant_id,
      name,
      unit,
      current_qty: 0,
      min_qty: 0,
      cost_per_unit: 0,
    }));
    
    // Simulate insert
    console.log('Would insert stock:', newStockRows);
    
    // For test, just assign fake ids
    let idx = 0;
    for (const [name] of missingIngredients) {
      stockMap.set(name.trim().toLowerCase(), `fake-id-${idx++}`);
    }
  }

  const finalIngredients = ingredients
    .map(ing => ({ stock_item_id: stockMap.get(ing.name.toLowerCase()), qty: ing.qty }))
    .filter(ing => ing.stock_item_id);

  console.log('Final ingredients:', finalIngredients);
}

run();
