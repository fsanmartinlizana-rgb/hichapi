/**
 * Test parser with all sets from the SII file
 */

import { readFileSync } from 'fs';

const fileContent = readFileSync('.kiro/SII/SIISetDePruebas770421489.txt', 'utf-8');

// Split by SET headers to test each set independently
const setRegex = /SET\s+(.+?)\s+-\s+NUMERO DE ATENCION:\s+(\d+)/g;
const matches = Array.from(fileContent.matchAll(setRegex));

console.log(`Found ${matches.length} sets in the file\n`);

matches.forEach((match, index) => {
  const setType = match[1].trim();
  const attentionNumber = match[2];
  
  console.log(`${index + 1}. ${setType} (${attentionNumber})`);
});

// Now let's test specific sets
import { parseSetDePruebas } from './certification-parser';

// Test export set
console.log('\n=== TESTING EXPORT SET ===');
const exportSetStart = fileContent.indexOf('SET BASICO DOCUMENTOS DE EXPORTACION (1)');
const exportSetEnd = fileContent.indexOf('SET BASICO DOCUMENTOS DE EXPORTACION (2)');
const exportSet1Content = fileContent.substring(exportSetStart, exportSetEnd);

try {
  const exportResult = parseSetDePruebas(exportSet1Content);
  console.log(`Parsed ${exportResult.cases.length} cases from export set 1`);
  
  const exportCases = exportResult.cases.filter(c => c.export_data);
  console.log(`Cases with export data: ${exportCases.length}`);
  
  if (exportCases.length > 0) {
    const firstExport = exportCases[0];
    console.log(`\nFirst export case (${firstExport.case_number}):`);
    console.log(`  Moneda: ${firstExport.export_data?.moneda}`);
    console.log(`  Forma pago: ${firstExport.export_data?.forma_pago}`);
    console.log(`  Clausula: ${firstExport.export_data?.clausula_venta}`);
    console.log(`  Puerto embarque: ${firstExport.export_data?.puerto_embarque}`);
    console.log(`  Pais: ${firstExport.export_data?.pais_destino}`);
    console.log(`  Flete: ${firstExport.export_data?.flete}`);
    console.log(`  Seguro: ${firstExport.export_data?.seguro}`);
  }
} catch (error) {
  console.error('Error parsing export set:', error);
}

// Test liquidacion set
console.log('\n=== TESTING LIQUIDACION SET ===');
const liqSetStart = fileContent.indexOf('SET BASICO LIQUIDACIONES');
const liqSetEnd = fileContent.indexOf('SET BASICO CASO GENERAL DE EMISOR');
const liqSetContent = fileContent.substring(liqSetStart, liqSetEnd);

try {
  const liqResult = parseSetDePruebas(liqSetContent);
  console.log(`Parsed ${liqResult.cases.length} cases from liquidacion set`);
  
  const liqCases = liqResult.cases.filter(c => c.liquidacion_data);
  console.log(`Cases with liquidacion data: ${liqCases.length}`);
  
  if (liqCases.length > 0) {
    const firstLiq = liqCases[0];
    console.log(`\nFirst liquidacion case (${firstLiq.case_number}):`);
    firstLiq.liquidacion_data?.comisiones.forEach(com => {
      console.log(`  ${com.descripcion}: ${com.monto}`);
    });
  }
} catch (error) {
  console.error('Error parsing liquidacion set:', error);
}

// Test ILA set (has global discounts)
console.log('\n=== TESTING ILA SET ===');
const ilaSetStart = fileContent.indexOf('SET IMPUESTO LEY ALCOHOLES');
const ilaSetEnd = fileContent.indexOf('SET GUIA DE DESPACHO');
const ilaSetContent = fileContent.substring(ilaSetStart, ilaSetEnd);

try {
  const ilaResult = parseSetDePruebas(ilaSetContent);
  console.log(`Parsed ${ilaResult.cases.length} cases from ILA set`);
  
  const discountCases = ilaResult.cases.filter(c => c.global_discount);
  console.log(`Cases with global discount: ${discountCases.length}`);
  
  if (discountCases.length > 0) {
    discountCases.forEach(c => {
      console.log(`  Case ${c.case_number}: ${c.global_discount?.type === 'D' ? 'Descuento' : 'Recargo'} ${c.global_discount?.value}%`);
    });
  }
} catch (error) {
  console.error('Error parsing ILA set:', error);
}
