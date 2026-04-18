/**
 * Certification Parser for SII SET_DE_PRUEBAS files
 * 
 * Extracts structured test case data from SII-provided certification test files.
 * Supports all DTE document types: 33, 34, 39, 41, 43, 46, 52, 56, 61, 110, 111, 112
 * 
 * Enhanced Error Handling Features:
 * - Logs warnings for malformed cases and continues parsing remaining cases
 * - Marks cases with missing required fields as invalid but includes them for audit
 * - Defaults numeric parsing errors to 0 with warning logs
 * - Returns structured ParsedTestCase array with raw_text for audit purposes
 * - Validates file format and provides detailed error messages
 * - Gracefully handles empty or invalid input data
 */

/**
 * Parsed item from a test case
 */
export interface ParsedItem {
  name: string
  quantity: number
  unit_price?: number              // Optional for some document types
  total_line?: number              // For liquidaciones
  discount_pct?: number            // Item-level discount percentage
  ind_exe?: 1                      // Exempt flag
  cod_imp_adic?: number            // Additional tax code (ILA)
  unit_measure?: string            // For export documents
}

/**
 * Receptor (customer) data for a test case
 */
export interface ReceptorData {
  rut?: string
  razon_social?: string
  giro?: string
  direccion?: string
  comuna?: string
}

/**
 * Reference data linking to previous documents
 */
export interface ReferenceData {
  tipo_doc_ref: number             // Referenced document type
  folio_ref?: number               // Referenced folio (resolved from previous cases)
  case_ref?: string                // Reference to case number (e.g., "4784148-1")
  fch_ref?: string                 // Reference date
  cod_ref: 1 | 2 | 3               // Reference code
  razon_ref: string                // Reference reason
}

/**
 * Global discount or surcharge
 */
export interface GlobalDiscount {
  type: 'D' | 'R'                  // Descuento or Recargo
  value_type: '$' | '%'            // Dollar amount or percentage
  value: number
}

/**
 * Export-specific data for international sales
 */
export interface ExportData {
  moneda: string
  forma_pago: string
  modalidad_venta?: string
  clausula_venta: string
  total_clausula?: number
  via_transporte: string
  puerto_embarque: string
  puerto_desembarque: string
  pais_receptor: string
  pais_destino: string
  tipo_bulto?: string
  total_bultos?: number
  peso_bruto?: number
  peso_neto?: number
  flete?: number
  seguro?: number
  comisiones_pct?: number
  nacionalidad?: string
}

/**
 * Liquidación-specific data for commission documents
 */
export interface LiquidacionData {
  comisiones: Array<{ descripcion: string; monto: number }>
}

/**
 * Complete parsed test case with all associated data
 */
export interface ParsedTestCase {
  case_number: string              // e.g., "4784148-1"
  document_type: number            // 33, 34, 39, 41, 43, 46, 52, 56, 61, 110, 111, 112
  items: ParsedItem[]
  receptor_data?: ReceptorData
  reference_data?: ReferenceData
  global_discount?: GlobalDiscount
  export_data?: ExportData
  liquidacion_data?: LiquidacionData
  raw_text: string                 // Original case text for audit
}

/**
 * Result of parsing a complete SET_DE_PRUEBAS file
 */
export interface ParsedSetDePruebas {
  attention_number: string
  set_type: string                 // "BASICO", "LIBRO DE VENTAS", "IMPUESTO LEY ALCOHOLES", etc.
  cases: ParsedTestCase[]
  raw_content: string
}

/**
 * Parse a SII SET_DE_PRUEBAS text file into structured test cases
 * 
 * @param fileContent - Raw text content of the SET_DE_PRUEBAS file
 * @returns Parsed test set with attention number, type, and all test cases
 * 
 * @example
 * const result = parseSetDePruebas(fileContent);
 * console.log(`Attention: ${result.attention_number}`);
 * console.log(`Cases: ${result.cases.length}`);
 */
export function parseSetDePruebas(fileContent: string): ParsedSetDePruebas {
  // Extract attention number and set type
  const { attention_number, set_type } = extractAttentionNumber(fileContent);
  
  // Split into individual cases (only from the first set)
  const caseSections = splitIntoCases(fileContent, attention_number);
  
  // Parse each case with enhanced error handling
  const cases: ParsedTestCase[] = [];
  const parseErrors: string[] = [];
  
  for (const section of caseSections) {
    try {
      const parsedCase = parseCase(section);
      
      // Validate required fields
      if (!parsedCase.case_number || !parsedCase.document_type || parsedCase.items.length === 0) {
        const missingFields = [];
        if (!parsedCase.case_number) missingFields.push('case_number');
        if (!parsedCase.document_type) missingFields.push('document_type');
        if (parsedCase.items.length === 0) missingFields.push('items');
        
        console.warn(`Case ${section.case_number} missing required fields: ${missingFields.join(', ')}. Marking as invalid but including in results.`);
        parseErrors.push(`Case ${section.case_number}: Missing required fields - ${missingFields.join(', ')}`);
      }
      
      cases.push(parsedCase);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Failed to parse case ${section.case_number}: ${errorMessage}. Continuing with remaining cases.`);
      parseErrors.push(`Case ${section.case_number}: ${errorMessage}`);
      
      // Create a minimal case entry for audit purposes
      const fallbackCase: ParsedTestCase = {
        case_number: section.case_number || 'unknown',
        document_type: 33, // Default to factura
        items: [],
        raw_text: section.raw_text
      };
      cases.push(fallbackCase);
    }
  }
  
  if (parseErrors.length > 0) {
    console.warn(`Parsing completed with ${parseErrors.length} errors. Total cases processed: ${cases.length}`);
  }
  
  return {
    attention_number,
    set_type,
    cases,
    raw_content: fileContent
  };
}

/**
 * Extract attention number and set type from file header
 * 
 * @param fileContent - Raw text content
 * @returns Object with attention_number and set_type
 */
function extractAttentionNumber(fileContent: string): { attention_number: string; set_type: string } {
  if (!fileContent || typeof fileContent !== 'string') {
    throw new Error('Invalid file content provided. File content must be a non-empty string.');
  }

  // Pattern: SET <TYPE> - NUMERO DE ATENCION: <NUMBER>
  const attentionRegex = /SET\s+(.+?)\s+-\s+NUMERO DE ATENCION:\s+(\d+)/i;
  const match = fileContent.match(attentionRegex);
  
  if (!match) {
    throw new Error('Could not extract attention number from file. Invalid SET_DE_PRUEBAS format. Expected format: "SET <TYPE> - NUMERO DE ATENCION: <NUMBER>"');
  }
  
  const set_type = match[1].trim();
  const attention_number = match[2];
  
  if (!set_type || !attention_number) {
    throw new Error('Extracted attention number or set type is empty. File may be malformed.');
  }
  
  return { attention_number, set_type };
}

/**
 * Split file content into individual CASO sections
 * 
 * @param fileContent - Raw text content
 * @param attention_number - Attention number to filter cases by
 * @returns Array of case sections with case_number and raw_text
 */
function splitIntoCases(fileContent: string, attention_number: string): Array<{ case_number: string; raw_text: string }> {
  // Pattern: CASO <NUMBER>-<SUBNUM> at the start of a line
  const caseRegex = /^CASO\s+(\d+-\d+)/gm;
  
  const cases: Array<{ case_number: string; raw_text: string }> = [];
  const matches = Array.from(fileContent.matchAll(caseRegex));
  
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const case_number = match[1];
    
    // Only include cases from the first set (matching attention number)
    if (!case_number.startsWith(attention_number + '-')) {
      continue;
    }
    
    const startIndex = match.index!;
    
    // Find the end of this case (start of next case, separator line, or end of file)
    let endIndex: number;
    
    const nextMatch = matches[i + 1];
    if (nextMatch) {
      endIndex = nextMatch.index!;
    } else {
      // Look for separator line (dashes) that indicates end of set
      const separatorRegex = /^-{10,}$/m;
      const separatorMatch = separatorRegex.exec(fileContent.substring(startIndex));
      if (separatorMatch && separatorMatch.index) {
        endIndex = startIndex + separatorMatch.index;
      } else {
        endIndex = fileContent.length;
      }
    }
    
    // Extract the raw text for this case
    const raw_text = fileContent.substring(startIndex, endIndex).trim();
    
    cases.push({ case_number, raw_text });
  }
  
  return cases;
}

/**
 * Parse a single case section into structured data
 * 
 * @param section - Case section with case_number and raw_text
 * @returns Parsed test case
 */
function parseCase(section: { case_number: string; raw_text: string }): ParsedTestCase {
  const { case_number, raw_text } = section;
  
  // Extract document type
  const document_type = extractDocumentType(raw_text);
  
  // Extract items
  const items = extractItems(raw_text);
  
  // Extract global discount (if present)
  const global_discount = extractGlobalDiscount(raw_text);
  
  // Extract reference data (for notas de crédito/débito)
  const reference_data = extractReferenceData(raw_text);
  
  // Extract export data (for facturas de exportación)
  const export_data = extractExportData(raw_text);
  
  // Extract liquidacion data (for liquidaciones)
  const liquidacion_data = extractLiquidacionData(raw_text);
  
  return {
    case_number,
    document_type,
    items,
    ...(global_discount && { global_discount }),
    ...(reference_data && { reference_data }),
    ...(export_data && { export_data }),
    ...(liquidacion_data && { liquidacion_data }),
    raw_text
  };
}

/**
 * Extract items from case text
 * 
 * Parses item table format with columns: ITEM, CANTIDAD, PRECIO UNITARIO, DESCUENTO ITEM
 * Handles:
 * - Thousand separators (.) in numeric values
 * - Item-level discount percentages
 * - Exempt items (EXENTO, SERVICIO EXENTO markers)
 * - Additional tax codes (CON ILA marker for Impuesto Ley Alcoholes)
 * 
 * @param caseText - Raw case text
 * @returns Array of parsed items
 */
function extractItems(caseText: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  
  if (!caseText || typeof caseText !== 'string') {
    console.warn('Invalid case text provided for item extraction. Returning empty items array.');
    return items;
  }
  
  // Split text into lines
  const lines = caseText.split('\n');
  
  // Find the line with "ITEM" header (may have CANTIDAD, PRECIO UNITARIO, DESCUENTO ITEM columns)
  let itemSectionStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Match lines that start with "ITEM" and have column headers
    if (line.match(/^ITEM\s/i)) {
      itemSectionStartIndex = i + 1;
      break;
    }
  }
  
  if (itemSectionStartIndex === -1) {
    // No items section found
    console.warn('No ITEM section found in case text. This may indicate a malformed case.');
    return items;
  }
  
  // Parse item lines until we hit a blank line or a non-item line
  let itemsProcessed = 0;
  let itemsSkipped = 0;
  
  for (let i = itemSectionStartIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // Stop at blank lines or lines that start with keywords indicating end of items
    if (!line.trim() || 
        line.match(/^(DESCUENTO GLOBAL|RECARGO|TASA DE ILA|REFERENCIA|MONEDA|FORMA DE PAGO|COMISIONES|LOS PRECIOS)/i)) {
      break;
    }
    
    // Parse item line
    const item = parseItemLine(line);
    if (item) {
      items.push(item);
      itemsProcessed++;
    } else {
      itemsSkipped++;
    }
  }
  
  if (itemsSkipped > 0) {
    console.warn(`Skipped ${itemsSkipped} malformed item lines during parsing. Successfully processed ${itemsProcessed} items.`);
  }
  
  if (items.length === 0) {
    console.warn('No valid items were extracted from case text. This case may be malformed or use an unsupported format.');
  }
  
  return items;
}

/**
 * Parse a single item line
 * 
 * Format examples:
 * - "Cajón AFECTO		    178		   4068"
 * - "Pañuelo AFECTO		    877		   6763			     11%"
 * - "ITEM 3 SERVICIO EXENTO	      1		  35424"
 * - "ITEM 1 CON ILA		    127		   1140"
 * 
 * @param line - Raw item line
 * @returns Parsed item or null if line doesn't match item format
 */
function parseItemLine(line: string): ParsedItem | null {
  if (!line || typeof line !== 'string') {
    console.warn('Invalid item line provided. Skipping.');
    return null;
  }

  // Item lines are tab-separated or have multiple spaces
  // Split by tabs or multiple spaces
  const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(p => p.length > 0);
  
  if (parts.length < 2) {
    // Not enough parts for a valid item line
    console.warn(`Item line has insufficient parts (${parts.length}): "${line}". Skipping.`);
    return null;
  }
  
  // First part is the item name
  const namePart = parts[0];
  
  // Check for exempt markers
  const isExempt = namePart.match(/\b(EXENTO|SERVICIO EXENTO)\b/i);
  
  // Check for ILA marker (Impuesto Ley Alcoholes)
  const hasILA = namePart.match(/\bCON ILA\b/i);
  
  // Extract item name (everything before AFECTO, EXENTO, CON ILA markers)
  let name = namePart;
  name = name.replace(/\s+(AFECTO|EXENTO|SERVICIO EXENTO|CON ILA|SOLO IVA)\s*$/i, '').trim();
  
  if (!name) {
    console.warn(`Item line has empty name after processing: "${line}". Using fallback name.`);
    name = 'ITEM SIN NOMBRE';
  }
  
  // Second part is quantity
  const quantity = parseNumericValue(parts[1]);
  
  // Third part is unit price (if present)
  let unit_price: number | undefined;
  if (parts.length >= 3 && !parts[2].includes('%')) {
    unit_price = parseNumericValue(parts[2]);
  }
  
  // Fourth part is discount percentage (if present)
  let discount_pct: number | undefined;
  if (parts.length >= 4) {
    const discountMatch = parts[3].match(/(\d+)\s*%/);
    if (discountMatch) {
      discount_pct = parseInt(discountMatch[1], 10);
      if (isNaN(discount_pct)) {
        console.warn(`Invalid discount percentage in item line: "${parts[3]}". Ignoring discount.`);
        discount_pct = undefined;
      }
    }
  }
  
  // Build item object
  const item: ParsedItem = {
    name,
    quantity
  };
  
  if (unit_price !== undefined) {
    item.unit_price = unit_price;
  }
  
  if (discount_pct !== undefined) {
    item.discount_pct = discount_pct;
  }
  
  if (isExempt) {
    item.ind_exe = 1;
  }
  
  if (hasILA) {
    // CodImpAdic for ILA - the actual code will be determined by the engine
    // For now, we just mark that this item has ILA
    item.cod_imp_adic = 1; // Placeholder - actual ILA code will be set during generation
  }
  
  return item;
}

/**
 * Parse numeric value, removing thousand separators
 * 
 * Examples:
 * - "4068" → 4068
 * - "4.068" → 4068
 * - "35424" → 35424
 * - "35.424" → 35424
 * 
 * @param value - String value with possible thousand separators
 * @returns Parsed numeric value, defaults to 0 with warning if parsing fails
 */
function parseNumericValue(value: string): number {
  if (!value || typeof value !== 'string') {
    console.warn(`Invalid numeric value provided: ${value}. Defaulting to 0.`);
    return 0;
  }

  // Remove thousand separators (.) and trim whitespace
  const cleaned = value.trim().replace(/\./g, '');
  
  // Parse as integer
  const parsed = parseInt(cleaned, 10);
  
  if (isNaN(parsed)) {
    console.warn(`Failed to parse numeric value: "${value}". Defaulting to 0.`);
    return 0;
  }
  
  return parsed;
}

/**
 * Extract document type from case text
 * 
 * @param caseText - Raw case text
 * @returns Document type code (33, 34, 39, 41, 43, 46, 52, 56, 61, 110, 111, 112)
 */
function extractDocumentType(caseText: string): number {
  // Pattern: DOCUMENTO <DOCUMENT_NAME> (with possible tabs/spaces)
  const docRegex = /DOCUMENTO[\s\t]+(.+)/i;
  const match = caseText.match(docRegex);
  
  if (!match) {
    console.warn('Could not extract document type from case. Defaulting to 33 (Factura Electrónica).');
    return 33;
  }
  
  const docName = match[1].trim().toUpperCase();
  
  // Map document names to type codes
  const documentTypeMap: Record<string, number> = {
    'FACTURA ELECTRONICA': 33,
    'FACTURA NO AFECTA O EXENTA ELECTRONICA': 34,
    'BOLETA AFECTA ELECTRONICA': 39,
    'BOLETA EXENTA ELECTRONICA': 41,
    'LIQUIDACION FACTURA ELECTRONICA': 43,
    'FACTURA DE COMPRA ELECTRONICA': 46,
    'GUIA DE DESPACHO': 52,
    'GUIA DE DESPACHO ELECTRONICA': 52,
    'NOTA DE DEBITO ELECTRONICA': 56,
    'NOTA DE CREDITO ELECTRONICA': 61,
    'FACTURA DE EXPORTACION ELECTRONICA': 110,
    'NOTA DE DEBITO DE EXPORTACION ELECTRONICA': 111,
    'NOTA DE CREDITO DE EXPORTACION ELECTRONICA': 112
  };
  
  const documentType = documentTypeMap[docName];
  
  if (!documentType) {
    console.warn(`Unknown document type: "${docName}". Defaulting to 33 (Factura Electrónica).`);
    return 33;
  }
  
  return documentType;
}

/**
 * Extract global discount or surcharge from case text
 * 
 * Patterns:
 * - "DESCUENTO GLOBAL ITEMES AFECTOS		     26%"
 * - "DESCUENTO GLOBAL	      2 %"
 * - "RECARGO GLOBAL	      5%"
 * - "%10 RECARGO EN LA LINEA DE ITEM POR COMISIONES EN EL EXTERIOR"
 * - "COMISIONES EN EL EXTRANJERO (RECARGOS GLOBALES):  11% DEL TOTAL DE LA CLAUSULA"
 * 
 * @param caseText - Raw case text
 * @returns GlobalDiscount object or undefined if not found
 */
function extractGlobalDiscount(caseText: string): GlobalDiscount | undefined {
  // Pattern 1: DESCUENTO GLOBAL ... <percentage>%
  const descuentoMatch = caseText.match(/DESCUENTO GLOBAL[^\n]*?(\d+)\s*%/i);
  if (descuentoMatch) {
    return {
      type: 'D',
      value_type: '%',
      value: parseInt(descuentoMatch[1], 10)
    };
  }
  
  // Pattern 2: RECARGO GLOBAL ... <percentage>%
  const recargoMatch = caseText.match(/RECARGO GLOBAL[^\n]*?(\d+)\s*%/i);
  if (recargoMatch) {
    return {
      type: 'R',
      value_type: '%',
      value: parseInt(recargoMatch[1], 10)
    };
  }
  
  // Pattern 3: %<percentage> RECARGO (for export documents)
  const recargoExportMatch = caseText.match(/%(\d+)\s+RECARGO/i);
  if (recargoExportMatch) {
    return {
      type: 'R',
      value_type: '%',
      value: parseInt(recargoExportMatch[1], 10)
    };
  }
  
  // Pattern 4: COMISIONES EN EL EXTRANJERO (RECARGOS GLOBALES): <percentage>%
  const comisionesMatch = caseText.match(/COMISIONES EN EL EXTRANJERO[^\n]*?(\d+)\s*%/i);
  if (comisionesMatch) {
    return {
      type: 'R',
      value_type: '%',
      value: parseInt(comisionesMatch[1], 10)
    };
  }
  
  return undefined;
}

/**
 * Extract reference data from nota de crédito/débito
 * 
 * Patterns:
 * - "REFERENCIA		FACTURA ELECTRONICA CORRESPONDIENTE A CASO 4784148-1"
 * - "RAZON REFERENCIA	CORRIGE GIRO DEL RECEPTOR"
 * - "REFERENCIA	FACTURA ELECTRONICA CORRESPONDIENTE A CASO 4784151-1"
 * - "RAZON REFERENCIA: DEVOLUCION DE MERCADERIAS DE ITEMS 1 Y 2"
 * 
 * @param caseText - Raw case text
 * @returns ReferenceData object or undefined if not found
 */
function extractReferenceData(caseText: string): ReferenceData | undefined {
  // Pattern: REFERENCIA ... CORRESPONDIENTE A CASO <case_number>
  const referenciaMatch = caseText.match(/REFERENCIA[\s\t]+(.+?)CORRESPONDIENTE A CASO\s+(\d+-\d+)/i);
  
  if (!referenciaMatch) {
    return undefined;
  }
  
  const docTypeText = referenciaMatch[1].trim().toUpperCase();
  const case_ref = referenciaMatch[2];
  
  // Map document type text to type code
  const docTypeMap: Record<string, number> = {
    'FACTURA ELECTRONICA': 33,
    'FACTURA NO AFECTA O EXENTA ELECTRONICA': 34,
    'FACTURA DE EXPORTACION ELECTRONICA': 110,
    'NOTA DE CREDITO ELECTRONICA': 61,
    'NOTA DE CREDITO DE EXPORTACION ELECTRONICA': 112,
    'NOTA DE CREDITO': 61,
    'FACTURA DE COMPRA ELECTRONICA': 46
  };
  
  const tipo_doc_ref = docTypeMap[docTypeText] || 33;
  
  // Extract reason (RAZON REFERENCIA or RAZON REFERENCIA:)
  const razonMatch = caseText.match(/RAZON REFERENCIA:?[\s\t]+(.+)/i);
  const razon_ref = razonMatch ? razonMatch[1].trim() : '';
  
  // Determine cod_ref based on razon_ref content
  let cod_ref: 1 | 2 | 3 = 1; // Default to 1 (Anula documento de referencia)
  
  const razonLower = razon_ref.toLowerCase();
  if (razonLower.includes('anula')) {
    cod_ref = 1;
  } else if (razonLower.includes('corrige') || razonLower.includes('modifica')) {
    cod_ref = 3;
  } else if (razonLower.includes('devolucion') || razonLower.includes('devolución')) {
    cod_ref = 2;
  }
  
  return {
    tipo_doc_ref,
    case_ref,
    cod_ref,
    razon_ref
  };
}

/**
 * Extract export-specific data from factura de exportación
 * 
 * Patterns:
 * - "MONEDA DE LA OPERACION:                      LIBRA EST"
 * - "FORMA DE PAGO EXPORTACION:                   SIN PAGO"
 * - "MODALIDAD DE VENTA:                          EN CONSIGNACION CON UN MINIMO A FIRME"
 * - "CLAUSULA DE VENTA DE EXPORTACION:            CFR"
 * - "TOTAL CLAUSULA DE VENTA:                     4685.44"
 * - "VIA DE TRANSPORTE:                           MARITIMA, FLUVIAL Y LACUSTRE"
 * - "PUERTO DE EMBARQUE:                          SAN ANTONIO"
 * - "PUERTO DE DESEMBARQUE:                       BARCELONA"
 * - "PAIS RECEPTOR Y PAIS DESTINO:                ESPANA"
 * - "TIPO DE BULTO:                               ROLLOS"
 * - "TOTAL BULTOS:                                     88"
 * - "FLETE (**):                                  3658.88"
 * - "SEGURO (**):                                 2857.24"
 * - "NACIONALIDAD:			ITALIA"
 * 
 * @param caseText - Raw case text
 * @returns ExportData object or undefined if not found
 */
function extractExportData(caseText: string): ExportData | undefined {
  // Check if this is an export document
  const monedaMatch = caseText.match(/MONEDA DE LA OPERACION:[\s\t]+(.+)/i);
  
  if (!monedaMatch) {
    return undefined;
  }
  
  const moneda = monedaMatch[1].trim();
  
  // Extract forma de pago
  const formaPagoMatch = caseText.match(/FORMA DE PAGO EXPORTACION:[\s\t]+(.+)/i);
  const forma_pago = formaPagoMatch ? formaPagoMatch[1].trim() : '';
  
  // Extract modalidad de venta (optional)
  const modalidadMatch = caseText.match(/MODALIDAD DE VENTA:[\s\t]+(.+)/i);
  const modalidad_venta = modalidadMatch ? modalidadMatch[1].trim() : undefined;
  
  // Extract clausula de venta
  const clausulaMatch = caseText.match(/CLAUSULA DE VENTA DE EXPORTACION:[\s\t]+(.+)/i);
  const clausula_venta = clausulaMatch ? clausulaMatch[1].trim() : '';
  
  // Extract total clausula (optional)
  const totalClausulaMatch = caseText.match(/TOTAL CLAUSULA DE VENTA:[\s\t]+([\d.]+)/i);
  const total_clausula = totalClausulaMatch ? parseFloat(totalClausulaMatch[1]) : undefined;
  
  // Extract via de transporte
  const viaMatch = caseText.match(/VIA DE TRANSPORTE:[\s\t]+(.+)/i);
  const via_transporte = viaMatch ? viaMatch[1].trim() : '';
  
  // Extract puerto de embarque
  const puertoEmbarqueMatch = caseText.match(/PUERTO DE EMBARQUE:[\s\t]+(.+)/i);
  const puerto_embarque = puertoEmbarqueMatch ? puertoEmbarqueMatch[1].trim() : '';
  
  // Extract puerto de desembarque
  const puertoDesembarqueMatch = caseText.match(/PUERTO DE DESEMBARQUE:[\s\t]+(.+)/i);
  const puerto_desembarque = puertoDesembarqueMatch ? puertoDesembarqueMatch[1].trim() : '';
  
  // Extract pais receptor y destino
  const paisMatch = caseText.match(/PAIS RECEPTOR Y PAIS DESTINO:[\s\t]+(.+)/i);
  const pais_receptor = paisMatch ? paisMatch[1].trim() : '';
  const pais_destino = pais_receptor; // Same value for both
  
  // Extract tipo de bulto (optional)
  const tipoBultoMatch = caseText.match(/TIPO DE BULTO:[\s\t]+(.+)/i);
  const tipo_bulto = tipoBultoMatch ? tipoBultoMatch[1].trim() : undefined;
  
  // Extract total bultos (optional)
  const totalBultosMatch = caseText.match(/TOTAL BULTOS:[\s\t]+(\d+)/i);
  const total_bultos = totalBultosMatch ? parseInt(totalBultosMatch[1], 10) : undefined;
  
  // Extract flete (optional)
  const fleteMatch = caseText.match(/FLETE[^\n]*:[\s\t]+([\d.]+)/i);
  const flete = fleteMatch ? parseFloat(fleteMatch[1]) : undefined;
  
  // Extract seguro (optional)
  const seguroMatch = caseText.match(/SEGURO[^\n]*:[\s\t]+([\d.]+)/i);
  const seguro = seguroMatch ? parseFloat(seguroMatch[1]) : undefined;
  
  // Extract comisiones percentage (optional)
  const comisionesMatch = caseText.match(/COMISIONES[^\n]*?(\d+)\s*%/i);
  const comisiones_pct = comisionesMatch ? parseInt(comisionesMatch[1], 10) : undefined;
  
  // Extract nacionalidad (optional)
  const nacionalidadMatch = caseText.match(/NACIONALIDAD:[\s\t]+(.+)/i);
  const nacionalidad = nacionalidadMatch ? nacionalidadMatch[1].trim() : undefined;
  
  return {
    moneda,
    forma_pago,
    ...(modalidad_venta && { modalidad_venta }),
    clausula_venta,
    ...(total_clausula && { total_clausula }),
    via_transporte,
    puerto_embarque,
    puerto_desembarque,
    pais_receptor,
    pais_destino,
    ...(tipo_bulto && { tipo_bulto }),
    ...(total_bultos && { total_bultos }),
    ...(flete && { flete }),
    ...(seguro && { seguro }),
    ...(comisiones_pct && { comisiones_pct }),
    ...(nacionalidad && { nacionalidad })
  };
}

/**
 * Extract liquidacion-specific data (comisiones y otros cargos)
 * 
 * Patterns:
 * - "COMISIONES Y OTROS CARGOS	TOTAL LINEA"
 * - "NETO COMISIÓN FIJA		   4451"
 * - "NETO COMISIÓN VARIABLE		  10602"
 * 
 * @param caseText - Raw case text
 * @returns LiquidacionData object or undefined if not found
 */
function extractLiquidacionData(caseText: string): LiquidacionData | undefined {
  // Check if this is a liquidacion document with comisiones section
  const comisionesHeaderMatch = caseText.match(/COMISIONES Y OTROS CARGOS/i);
  
  if (!comisionesHeaderMatch) {
    return undefined;
  }
  
  const comisiones: Array<{ descripcion: string; monto: number }> = [];
  
  // Split text into lines
  const lines = caseText.split('\n');
  
  // Find the line with "COMISIONES Y OTROS CARGOS"
  let comisionesSectionStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/COMISIONES Y OTROS CARGOS/i)) {
      comisionesSectionStartIndex = i + 1;
      break;
    }
  }
  
  if (comisionesSectionStartIndex === -1) {
    return undefined;
  }
  
  // Parse comision lines until we hit a blank line or end of text
  for (let i = comisionesSectionStartIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // Stop at blank lines or lines that don't look like comision entries
    if (!line.trim() || line.match(/^-+$/)) {
      break;
    }
    
    // Parse comision line: "NETO COMISIÓN FIJA		   4451"
    // Split by tabs or multiple spaces
    const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(p => p.length > 0);
    
    if (parts.length >= 2) {
      const descripcion = parts[0];
      // Last part is the amount (may be negative)
      const montoStr = parts[parts.length - 1].replace(/\./g, ''); // Remove thousand separators
      const monto = parseInt(montoStr, 10);
      
      if (!isNaN(monto)) {
        comisiones.push({ descripcion, monto });
      }
    }
  }
  
  if (comisiones.length === 0) {
    return undefined;
  }
  
  return { comisiones };
}