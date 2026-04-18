/**
 * Quick test script to verify parser works with real SII file
 */

import { readFileSync } from 'fs';
import { parseSetDePruebas } from './certification-parser';

const fileContent = readFileSync('.kiro/SII/SIISetDePruebas770421489.txt', 'utf-8');
const result = parseSetDePruebas(fileContent);

console.log('=== PARSER TEST RESULTS ===\n');
console.log(`Attention Number: ${result.attention_number}`);
console.log(`Set Type: ${result.set_type}`);
console.log(`Total Cases: ${result.cases.length}\n`);

// Test cases with special fields
const casesWithSpecialFields = result.cases.filter(c => 
  c.global_discount || c.reference_data || c.export_data || c.liquidacion_data
);

console.log(`Cases with special fields: ${casesWithSpecialFields.length}\n`);

// Show examples
console.log('=== GLOBAL DISCOUNT EXAMPLES ===');
const discountCases = result.cases.filter(c => c.global_discount);
discountCases.slice(0, 3).forEach(c => {
  console.log(`Case ${c.case_number}: ${c.global_discount?.type === 'D' ? 'Descuento' : 'Recargo'} ${c.global_discount?.value}%`);
});

console.log('\n=== REFERENCE DATA EXAMPLES ===');
const refCases = result.cases.filter(c => c.reference_data);
refCases.slice(0, 3).forEach(c => {
  console.log(`Case ${c.case_number}: Ref tipo ${c.reference_data?.tipo_doc_ref}, caso ${c.reference_data?.case_ref}, cod ${c.reference_data?.cod_ref}`);
  console.log(`  Razón: ${c.reference_data?.razon_ref}`);
});

console.log('\n=== EXPORT DATA EXAMPLES ===');
const exportCases = result.cases.filter(c => c.export_data);
exportCases.slice(0, 2).forEach(c => {
  console.log(`Case ${c.case_number}:`);
  console.log(`  Moneda: ${c.export_data?.moneda}`);
  console.log(`  Clausula: ${c.export_data?.clausula_venta}`);
  console.log(`  Puerto embarque: ${c.export_data?.puerto_embarque}`);
  console.log(`  Pais: ${c.export_data?.pais_destino}`);
});

console.log('\n=== LIQUIDACION DATA EXAMPLES ===');
const liqCases = result.cases.filter(c => c.liquidacion_data);
liqCases.slice(0, 2).forEach(c => {
  console.log(`Case ${c.case_number}:`);
  c.liquidacion_data?.comisiones.forEach(com => {
    console.log(`  ${com.descripcion}: ${com.monto}`);
  });
});

console.log('\n=== SUMMARY ===');
console.log(`Cases with global discount: ${result.cases.filter(c => c.global_discount).length}`);
console.log(`Cases with reference data: ${result.cases.filter(c => c.reference_data).length}`);
console.log(`Cases with export data: ${result.cases.filter(c => c.export_data).length}`);
console.log(`Cases with liquidacion data: ${result.cases.filter(c => c.liquidacion_data).length}`);
