/**
 * Debug script to see what's being parsed
 */

import { readFileSync } from 'fs';
import { parseSetDePruebas } from './certification-parser';

const fileContent = readFileSync('.kiro/SII/SIISetDePruebas770421489.txt', 'utf-8');
const result = parseSetDePruebas(fileContent);

// Find case 4784148-6
const case6 = result.cases.find(c => c.case_number === '4784148-6');

if (case6) {
  console.log('=== CASE 4784148-6 RAW TEXT ===');
  console.log(case6.raw_text);
  console.log('\n=== REFERENCE DATA ===');
  console.log(JSON.stringify(case6.reference_data, null, 2));
  
  // Test the regex manually
  const razonMatch = case6.raw_text.match(/RAZON REFERENCIA:?[\s\t]+(.+?)(?:\n|$)/i);
  console.log('\n=== REGEX MATCH ===');
  console.log('Match:', razonMatch);
}
