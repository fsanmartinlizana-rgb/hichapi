const missingIngredients = new Map()
const stockMap = new Map()

const parsedItems = [
  {
    rawRecipe: "Lomo liso (kg): 0.25, Huevo (unidad): 2, Papas (kg): 0.3"
  }
];

const processed = parsedItems.map(i => {
  const ingredients = []
  if (i.rawRecipe && i.rawRecipe.trim().length > 0) {
    const parts = i.rawRecipe.split(/[,|]/)
    for (const p of parts) {
      if (!p.includes(':')) continue
      const [nRaw, qRaw] = p.split(':')
      let n = nRaw.trim()
      let unit = 'unidad'
      
      const unitMatch = n.match(/[\(\[]([a-zA-Z]+)[\)\]]$/)
      if (unitMatch) {
        const parsedUnit = unitMatch[1].toLowerCase()
        const validUnits = ['kg', 'g', 'l', 'ml', 'unidad', 'porcion', 'caja']
        if (validUnits.includes(parsedUnit)) {
          unit = parsedUnit
        }
        n = n.replace(/[\(\[][a-zA-Z]+[\)\]]$/, '').trim()
      }
      
      const q = parseFloat(qRaw)
      if (n && !isNaN(q) && q > 0) {
        ingredients.push({ name: n, qty: q })
        if (!stockMap.has(n.toLowerCase())) {
          missingIngredients.set(n, unit)
        }
      }
    }
  }
  return { ...i, _parsedIngredients: ingredients }
})

// Simular creación
const insertedStock = Array.from(missingIngredients.entries()).map(([name, unit], idx) => ({
  id: 'uuid-' + idx,
  name,
  unit
}))

for (const s of insertedStock) {
  stockMap.set(s.name.trim().toLowerCase(), s.id)
}

const rows = processed.map(i => {
  const finalIngredients = i._parsedIngredients
    .map(ing => ({ stock_item_id: stockMap.get(ing.name.toLowerCase()), qty: ing.qty }))
    .filter(ing => ing.stock_item_id)
  
  return { ingredients: finalIngredients }
})

console.log(JSON.stringify(rows, null, 2))
