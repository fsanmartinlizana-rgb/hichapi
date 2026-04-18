import { describe, it, expect } from 'vitest';
import { parseSetDePruebas } from './certification-parser';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('certification-parser integration', () => {
  it('should parse the actual SII test file', () => {
    const filePath = join(process.cwd(), '.kiro/SII/SIISetDePruebas770421489.txt');
    const fileContent = readFileSync(filePath, 'utf-8');

    const result = parseSetDePruebas(fileContent);

    expect(result.attention_number).toBe('4784148');
    expect(result.set_type).toBe('BASICO');
    expect(result.cases.length).toBeGreaterThan(0);

    // Check first case (4784148-1)
    const case1 = result.cases.find(c => c.case_number === '4784148-1');
    expect(case1).toBeDefined();
    expect(case1!.document_type).toBe(33); // Factura Electrónica
    expect(case1!.items).toHaveLength(2);
    // Note: File uses ISO-8859-1 encoding, so special characters may not match exactly
    expect(case1!.items[0].name).toContain('Caj');
    expect(case1!.items[0].quantity).toBe(178);
    expect(case1!.items[0].unit_price).toBe(4068);

    // Check case with discounts (4784148-2)
    const case2 = result.cases.find(c => c.case_number === '4784148-2');
    expect(case2).toBeDefined();
    expect(case2!.items).toHaveLength(2);
    expect(case2!.items[0].discount_pct).toBe(11);
    expect(case2!.items[1].discount_pct).toBe(27);

    // Check case with exempt items (4784148-3)
    const case3 = result.cases.find(c => c.case_number === '4784148-3');
    expect(case3).toBeDefined();
    expect(case3!.items).toHaveLength(3);
    expect(case3!.items[2].ind_exe).toBe(1);

    // Check nota de crédito with only quantities (4784148-6)
    const case6 = result.cases.find(c => c.case_number === '4784148-6');
    expect(case6).toBeDefined();
    expect(case6!.document_type).toBe(61); // Nota de Crédito
    expect(case6!.items).toHaveLength(2);
    expect(case6!.items[0].name).toContain('Pa');
    expect(case6!.items[0].quantity).toBe(322);
    expect(case6!.items[0].unit_price).toBeUndefined();
  });

  it('should parse ILA cases correctly from the full file', () => {
    const filePath = join(process.cwd(), '.kiro/SII/SIISetDePruebas770421489.txt');
    const fileContent = readFileSync(filePath, 'utf-8');

    // The full file contains multiple sets, but parseSetDePruebas only parses the first one
    // So we need to manually extract the ILA set section
    const ilaSetStart = fileContent.indexOf('SET IMPUESTO LEY ALCOHOLES');
    const ilaSetEnd = fileContent.indexOf('--------------------------------------------------------------------------------', ilaSetStart);
    const ilaSetContent = fileContent.substring(ilaSetStart, ilaSetEnd);

    const result = parseSetDePruebas(ilaSetContent);

    expect(result.attention_number).toBe('4784151');
    expect(result.set_type).toBe('IMPUESTO LEY ALCOHOLES');
    expect(result.cases.length).toBeGreaterThan(0);

    // Find ILA case (4784151-1)
    const ilaCase = result.cases.find(c => c.case_number === '4784151-1');
    expect(ilaCase).toBeDefined();
    expect(ilaCase!.items).toHaveLength(3);
    
    // Items 1 and 3 should have ILA marker
    expect(ilaCase!.items[0].name).toBe('ITEM 1');
    expect(ilaCase!.items[0].cod_imp_adic).toBe(1);
    
    expect(ilaCase!.items[1].name).toBe('ITEM 2');
    expect(ilaCase!.items[1].cod_imp_adic).toBeUndefined();
    
    expect(ilaCase!.items[2].name).toBe('ITEM 3');
    expect(ilaCase!.items[2].cod_imp_adic).toBe(1);
  });
});
