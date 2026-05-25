const XLSX = require('xlsx');

const ws = XLSX.utils.aoa_to_sheet([
  ["Nombre", "Unidad", "Cantidad", "Cantidad Minima", "Costo por unidad"],
  ["Lomo Liso", "kg", 10, 2, 8500]
]);

const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
const normalizedRows = rows.map(r => {
  const norm = {};
  for (const k in r) {
    const newK = k.toLowerCase().replace(/\s+/g, '_');
    norm[newK] = r[k];
  }
  return norm;
});

console.log(normalizedRows);
