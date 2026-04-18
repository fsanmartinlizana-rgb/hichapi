/**
 * Debug export case parsing
 */

import { readFileSync } from 'fs';
import { parseSetDePruebas } from './certification-parser';

const fileContent = readFileSync('.kiro/SII/SIISetDePruebas770421489.txt', 'utf-8');

const exportSetStart = fileContent.indexOf('SET BASICO DOCUMENTOS DE EXPORTACION (1)');
const exportSetEnd = fileContent.indexOf('SET BASICO DOCUMENTOS DE EXPORTACION (2)');
const exportSet1Content = fileContent.substring(exportSetStart, exportSetEnd);

const result = parseSetDePruebas(exportSet1Content);

console.log(`Parsed ${result.cases.length} cases`);

result.cases.forEach(c => {
  console.log(`\n=== Case ${c.case_number} ===`);
  console.log(`Document type: ${c.document_type}`);
  console.log(`Items: ${c.items.length}`);
  console.log(`Has export data: ${!!c.export_data}`);
  
  if (c.export_data) {
    console.log('Export data:', JSON.stringify(c.export_data, null, 2));
  }
  
  // Show first few lines of raw text
  const lines = c.raw_text.split('\n').slice(0, 10);
  console.log('\nFirst lines:');
  lines.forEach(line => console.log('  ' + line));
});
