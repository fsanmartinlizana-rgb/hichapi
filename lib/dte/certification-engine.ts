/**
 * Certification Engine Module
 * 
 * Orchestrates batch DTE generation, signing, and submission for SII certification.
 * This module provides the core interfaces and functions for managing the certification
 * process including batch generation, submission, and status checking.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { takeNextFolio } from '@/lib/dte/folio'
import { DteInput, DteLineItem, buildDteXml, signDte } from '@/lib/dte/signer'
import { getSiiToken, getSiiTokenFactura, sendDteToSII, sendFacturaToSII, checkDteStatus, queryEstDteFactura } from '@/lib/dte/sii-client'
import { decrypt } from '@/lib/crypto/aes'
import { C14nCanonicalization } from 'xml-crypto'
import * as crypto from 'crypto'
import * as forge from 'node-forge'

/**
 * Result of a certification batch generation and processing operation
 */
export interface CertificationBatchResult {
  /** Unique identifier of the test set */
  test_set_id: string
  /** Number of DTEs successfully generated */
  generated_count: number
  /** Number of DTEs successfully signed */
  signed_count: number
  /** Number of DTEs successfully submitted */
  submitted_count: number
  /** Array of track IDs returned by SII for submitted batches */
  track_ids: string[]
  /** Array of errors encountered during processing */
  errors: Array<{ case_number: string; error: string }>
}

/**
 * Maps a ParsedTestCase to DteInput format for XML generation
 */
function mapTestCaseToDteInput(
  testCase: any, // test_cases row from database
  restaurant: any, // restaurant data
  folioMap: Record<string, number> // case_number → folio mapping
): DteInput {
  const isFactura = testCase.document_type === 33 || testCase.document_type === 56 || testCase.document_type === 61
  
  // Map items from JSONB to DteLineItem format
  const items: DteLineItem[] = (testCase.items || []).map((item: any) => ({
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price || 0,
    cod_imp_adic: item.cod_imp_adic,
    ind_exe: item.ind_exe
  }))
  
  // Calculate total amount from items
  const total_amount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
  
  // Get current date for emission
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  
  // Base DTE input - cast to supported type for now, will be extended in Task 5.1
  const dteInput: DteInput = {
    document_type: testCase.document_type as 33 | 39 | 41 | 56 | 61,
    folio: 0, // Will be set by caller
    fecha_emision: today,
    rut_emisor: restaurant.rut,
    razon_social: restaurant.razon_social,
    giro: restaurant.giro || '',
    direccion: restaurant.direccion || restaurant.address || '',
    comuna: restaurant.comuna || '',
    acteco: (restaurant as any).acteco || '463020', // Código de actividad económica (fallback a servicios de comida)
    total_amount: total_amount,
    items: items
  }
  
  // Validate critical emisor fields
  if (!dteInput.rut_emisor || !dteInput.razon_social) {
    throw new Error(`Missing critical emisor data: RUT=${dteInput.rut_emisor}, Razón Social=${dteInput.razon_social}`)
  }
  
  // Add receptor data for facturas
  if (isFactura && testCase.receptor_data) {
    const receptor = testCase.receptor_data
    dteInput.rut_receptor = receptor.rut || '96790240-3' // Default test RUT
    dteInput.razon_receptor = receptor.razon_social || 'EMPRESA DE PRUEBA'
    dteInput.giro_receptor = receptor.giro || 'GIRO DE PRUEBA'
    dteInput.direccion_receptor = receptor.direccion || 'DIRECCION DE PRUEBA'
    dteInput.comuna_receptor = receptor.comuna || 'SANTIAGO'
    dteInput.fma_pago = 1 // Default to contado
  }
  
  // Add reference data for notas
  if ((testCase.document_type === 56 || testCase.document_type === 61) && testCase.reference_data) {
    const ref = testCase.reference_data
    dteInput.tipo_doc_ref = ref.tipo_doc_ref
    dteInput.cod_ref = ref.cod_ref
    dteInput.razon_ref = ref.razon_ref
    
    // Resolve folio reference from case reference
    if (ref.case_ref && folioMap[ref.case_ref]) {
      dteInput.folio_ref = folioMap[ref.case_ref]
    } else if (ref.folio_ref) {
      dteInput.folio_ref = ref.folio_ref
    }
    
    // Use reference date or current date
    dteInput.fch_ref = ref.fch_ref || today
  }
  
  // Add global discount if present
  if (testCase.global_discount) {
    const discount = testCase.global_discount
    if (discount.type === 'D' && discount.value_type === '$') {
      dteInput.descuento_global = discount.value
    }
    // TODO: Handle percentage discounts and recargos
  }
  
  return dteInput
}

/**
 * Generates a complete batch of DTEs from parsed test cases
 * 
 * This function processes all test cases in a test set, generates the corresponding
 * DTE XMLs, signs them, and stores them as emission records ready for submission.
 * 
 * @param restaurantId - UUID of the restaurant
 * @param testSetId - UUID of the test set to process
 * @returns Promise resolving to batch generation results
 */
export async function generateCertificationBatch(
  restaurantId: string,
  testSetId: string
): Promise<CertificationBatchResult> {
  const supabase = createAdminClient()
  
  // Load test_set and all test_cases from database
  const { data: testSet, error: testSetError } = await supabase
    .from('test_sets')
    .select('*')
    .eq('id', testSetId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
    
  if (testSetError || !testSet) {
    return {
      test_set_id: testSetId,
      generated_count: 0,
      signed_count: 0,
      submitted_count: 0,
      track_ids: [],
      errors: [{ case_number: 'N/A', error: 'Test set not found' }]
    }
  }
  
  const { data: testCases, error: testCasesError } = await supabase
    .from('test_cases')
    .select('*')
    .eq('test_set_id', testSetId)
    .order('case_number')
    
  if (testCasesError || !testCases) {
    return {
      test_set_id: testSetId,
      generated_count: 0,
      signed_count: 0,
      submitted_count: 0,
      track_ids: [],
      errors: [{ case_number: 'N/A', error: 'Test cases not found' }]
    }
  }
  
  // Build case_number → folio reference map for resolving nota references
  const folioMap: Record<string, number> = {}
  const errors: Array<{ case_number: string; error: string }> = []
  let generated_count = 0
  let signed_count = 0
  
  // Load restaurant data
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('rut, razon_social, giro, address, direccion, comuna')
    .eq('id', restaurantId)
    .maybeSingle()
    
  if (restaurantError || !restaurant) {
    console.error('Error loading restaurant:', restaurantError)
    return {
      test_set_id: testSetId,
      generated_count: 0,
      signed_count: 0,
      submitted_count: 0,
      track_ids: [],
      errors: [{ case_number: 'N/A', error: `Restaurant not found: ${restaurantError?.message || 'Unknown error'}` }]
    }
  }
  
  // Normalize and clean restaurant data
  const normalizedRestaurant = {
    ...restaurant,
    rut: restaurant.rut?.trim() || null,
    razon_social: restaurant.razon_social?.trim() || null,
    giro: restaurant.giro?.trim() || '',
    direccion: (restaurant.direccion || restaurant.address || '').trim(),
    comuna: restaurant.comuna?.trim() || ''
  }
  
  // Log restaurant data for debugging
  console.log('Restaurant data loaded:', {
    id: restaurantId,
    rut: normalizedRestaurant.rut,
    razon_social: normalizedRestaurant.razon_social,
    giro: normalizedRestaurant.giro,
    direccion: normalizedRestaurant.direccion,
    comuna: normalizedRestaurant.comuna
  })
  
  // Validate required restaurant data
  if (!normalizedRestaurant.rut || !normalizedRestaurant.razon_social) {
    console.error('Restaurant validation failed:', {
      rut: normalizedRestaurant.rut,
      razon_social: normalizedRestaurant.razon_social,
      has_rut: !!normalizedRestaurant.rut,
      has_razon: !!normalizedRestaurant.razon_social
    })
    return {
      test_set_id: testSetId,
      generated_count: 0,
      signed_count: 0,
      submitted_count: 0,
      track_ids: [],
      errors: [{ case_number: 'N/A', error: `Restaurant missing required data: RUT=${normalizedRestaurant.rut || 'MISSING'}, Razón Social=${normalizedRestaurant.razon_social || 'MISSING'}` }]
    }
  }
  
  // Iterate through test_cases and map ParsedTestCase to DteInput format
  for (const testCase of testCases) {
    try {
      // Check if document type is supported by current signer
      const supportedTypes = [33, 39, 41, 56, 61]
      if (!supportedTypes.includes(testCase.document_type)) {
        errors.push({ 
          case_number: testCase.case_number, 
          error: `Document type ${testCase.document_type} not yet supported. Supported types: ${supportedTypes.join(', ')}` 
        })
        continue
      }
      
      // Call takeNextFolio() for each case to assign sequential folios
      const folioResult = await takeNextFolio(restaurantId, testCase.document_type)
      
      if ('error' in folioResult) {
        errors.push({ case_number: testCase.case_number, error: folioResult.error })
        continue
      }
      
      const { folio, caf_id } = folioResult
      
      // Store folio in reference map for resolving nota references
      folioMap[testCase.case_number] = folio
      
      // Map ParsedTestCase to DteInput format
      const dteInput = mapTestCaseToDteInput(testCase, normalizedRestaurant, folioMap)
      dteInput.folio = folio // Set the actual assigned folio
      
      // Call buildDteXml() to generate XML for each document type
      const xml = buildDteXml(dteInput)
      
      // Call signDte() to sign each generated XML
      const signResult = await signDte(restaurantId, xml, caf_id)
      
      if ('error' in signResult) {
        errors.push({ case_number: testCase.case_number, error: signResult.error })
        continue
      }
      
      generated_count++
      signed_count++
      
      // Calculate amounts for emission record
      const total_amount = dteInput.total_amount
      const net_amount = testCase.document_type === 41 ? 0 : Math.round(total_amount / 1.19) // Boleta exenta has no net amount
      const iva_amount = testCase.document_type === 41 ? 0 : total_amount - net_amount
      
      // Store emission records with certification metadata
      const { error: emissionError } = await supabase
        .from('dte_emissions')
        .insert({
          restaurant_id: restaurantId,
          test_case_id: testCase.id,
          is_certification: true,
          document_type: testCase.document_type,
          folio: folio,
          caf_id: caf_id,
          rut_emisor: restaurant.rut || '',
          rut_receptor: dteInput.rut_receptor || null,
          razon_receptor: dteInput.razon_receptor || null,
          net_amount: net_amount,
          iva_amount: iva_amount,
          total_amount: total_amount,
          status: 'signed',
          xml_signed: signResult.signed_xml,
          signed_at: new Date().toISOString(),
          // Receptor data for facturas
          giro_receptor: dteInput.giro_receptor,
          direccion_receptor: dteInput.direccion_receptor,
          comuna_receptor: dteInput.comuna_receptor,
          fma_pago: dteInput.fma_pago,
          // Reference data for notas
          tipo_doc_ref: dteInput.tipo_doc_ref,
          folio_ref: dteInput.folio_ref,
          fch_ref: dteInput.fch_ref,
          cod_ref: dteInput.cod_ref,
          razon_ref: dteInput.razon_ref
        })
        
      if (emissionError) {
        errors.push({ case_number: testCase.case_number, error: `Emission storage error: ${emissionError.message}` })
        continue
      }
      
      // Update test case status
      await supabase
        .from('test_cases')
        .update({ 
          status: 'signed',
          emission_id: null // Will be set by the emission insert trigger if needed
        })
        .eq('id', testCase.id)
        
    } catch (error) {
      // Handle errors gracefully: store error_detail, continue with remaining cases
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push({ case_number: testCase.case_number, error: errorMessage })
      
      // Update test case with error
      await supabase
        .from('test_cases')
        .update({ 
          status: 'error',
          error_message: errorMessage
        })
        .eq('id', testCase.id)
    }
  }
  
  // Update test set counts
  await supabase
    .from('test_sets')
    .update({
      generated_count: generated_count,
      status: generated_count > 0 ? 'generated' : 'uploaded'
    })
    .eq('id', testSetId)
  
  // Return CertificationBatchResult with counts and error list
  return {
    test_set_id: testSetId,
    generated_count,
    signed_count,
    submitted_count: 0, // Will be set during submission
    track_ids: [],
    errors
  }
}

/**
 * Submits a batch of signed DTEs to SII for certification
 * 
 * Groups DTEs by type (boletas vs facturas), creates appropriate envelopes,
 * and submits them to the SII certification environment.
 * 
 * @param restaurantId - UUID of the restaurant
 * @param testSetId - UUID of the test set to submit
 * @returns Promise resolving to submission result with track ID
 */
export async function submitCertificationBatch(
  restaurantId: string,
  testSetId: string
): Promise<{ track_id: string; success: boolean; error?: string }> {
  const supabase = createAdminClient()
  
  // Load all signed emissions for this test set
  const { data: testCases, error: testCasesError } = await supabase
    .from('test_cases')
    .select('id')
    .eq('test_set_id', testSetId)
    
  if (testCasesError || !testCases || testCases.length === 0) {
    return { 
      track_id: '', 
      success: false, 
      error: testCasesError?.message || 'No test cases found for test set' 
    }
  }
  
  const testCaseIds = testCases.map((tc: { id: string }) => tc.id)
  
  const { data: emissions, error: emissionsError } = await supabase
    .from('dte_emissions')
    .select('id, document_type, folio, xml_signed, rut_emisor, rut_receptor, razon_receptor')
    .eq('restaurant_id', restaurantId)
    .eq('is_certification', true)
    .eq('status', 'signed')
    .in('test_case_id', testCaseIds)
    .order('document_type', { ascending: true })
    .order('folio', { ascending: true })
    
  if (emissionsError || !emissions || emissions.length === 0) {
    return { 
      track_id: '', 
      success: false, 
      error: emissionsError?.message || 'No signed emissions found for test set' 
    }
  }
  
  // Load restaurant credentials for envelope signing
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('rut, dte_environment')
    .eq('id', restaurantId)
    .maybeSingle()
    
  if (restaurantError || !restaurant) {
    return { track_id: '', success: false, error: 'Restaurant not found' }
  }
  
  // Ensure environment is valid
  const environment = (restaurant.dte_environment === 'produccion' ? 'produccion' : 'certificacion') as 'certificacion' | 'produccion'
  
  // Load credentials for signing and submission
  const { data: credentials, error: credError } = await supabase
    .from('dte_credentials')
    .select('rut_envia, cert_ciphertext, cert_iv, cert_auth_tag, pass_ciphertext, pass_iv, pass_auth_tag')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
    
  if (credError || !credentials) {
    return { track_id: '', success: false, error: 'DTE credentials not found' }
  }
  
  // Decrypt PFX and password for authentication
  const pfxBuffer = decrypt({
    ciphertext: credentials.cert_ciphertext,
    iv: credentials.cert_iv,
    authTag: credentials.cert_auth_tag,
  })
  
  const passwordBuffer = decrypt({
    ciphertext: credentials.pass_ciphertext,
    iv: credentials.pass_iv,
    authTag: credentials.pass_auth_tag,
  })
  
  const password = passwordBuffer.toString('utf8')
  
  // Load certificate from PFX
  const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'))
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)
  
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  
  if (!certBags[forge.pki.oids.certBag] || !keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]) {
    return { track_id: '', success: false, error: 'Certificate or private key not found in PFX' }
  }
  
  const certificate = certBags[forge.pki.oids.certBag]?.[0]?.cert
  const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key
  
  if (!certificate || !privateKey) {
    return { track_id: '', success: false, error: 'Certificate or private key not found in PFX' }
  }
  
  const privateKeyPem = forge.pki.privateKeyToPem(privateKey)
  
  // Group emissions by document type (boletas vs facturas)
  const boletas = emissions.filter((e: { document_type: number }) => e.document_type === 39 || e.document_type === 41)
  const facturas = emissions.filter((e: { document_type: number }) => e.document_type !== 39 && e.document_type !== 41)
  
  const trackIds: string[] = []
  let submittedCount = 0
  
  try {
    // Submit boletas if any
    if (boletas.length > 0) {
      const boletaEnvelope = await createBatchEnvelope(boletas, restaurant.rut, credentials.rut_envia, true, credentials)
      const boletaResult = await submitEnvelopeToSII(boletaEnvelope, restaurant.rut, credentials.rut_envia, environment, true, privateKeyPem, certificate)
      
      if (boletaResult.success && boletaResult.track_id) {
        trackIds.push(boletaResult.track_id)
        
        // Update boleta emissions with track_id and status
        const boletaIds = boletas.map((b: { id: string }) => b.id)
        await supabase
          .from('dte_emissions')
          .update({ 
            status: 'sent', 
            sii_track_id: boletaResult.track_id,
            sent_at: new Date().toISOString()
          })
          .in('id', boletaIds)
          
        submittedCount += boletas.length
      } else {
        return { 
          track_id: '', 
          success: false, 
          error: `Boleta submission failed: ${boletaResult.error}` 
        }
      }
    }
    
    // Submit facturas if any
    if (facturas.length > 0) {
      const facturaEnvelope = await createBatchEnvelope(facturas, restaurant.rut, credentials.rut_envia, false, credentials)
      const facturaResult = await submitEnvelopeToSII(facturaEnvelope, restaurant.rut, credentials.rut_envia, environment, false, privateKeyPem, certificate)
      
      if (facturaResult.success && facturaResult.track_id) {
        trackIds.push(facturaResult.track_id)
        
        // Update factura emissions with track_id and status
        const facturaIds = facturas.map((f: { id: string }) => f.id)
        await supabase
          .from('dte_emissions')
          .update({ 
            status: 'sent', 
            sii_track_id: facturaResult.track_id,
            sent_at: new Date().toISOString()
          })
          .in('id', facturaIds)
          
        submittedCount += facturas.length
      } else {
        return { 
          track_id: '', 
          success: false, 
          error: `Factura submission failed: ${facturaResult.error}` 
        }
      }
    }
    
    // Update test set with submission counts
    await supabase
      .from('test_sets')
      .update({
        submitted_count: submittedCount,
        status: 'submitted'
      })
      .eq('id', testSetId)
    
    return { 
      track_id: trackIds.join(','), 
      success: true 
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during submission'
    return { track_id: '', success: false, error: errorMessage }
  }
}

/**
 * Retry helper function with exponential backoff
 * Implements requirement 7.7: retry up to three times with exponential backoff
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation()
      
      // For SII client responses, check if it's a network error that should be retried
      if (typeof result === 'object' && result !== null && 'error' in result) {
        const errorResult = result as { error?: string; success?: boolean }
        if (errorResult.error === 'NETWORK_ERROR' && attempt < maxRetries) {
          // Wait with exponential backoff before retrying
          const delay = baseDelay * Math.pow(2, attempt)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }
      
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < maxRetries) {
        // Wait with exponential backoff before retrying
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error('Max retries exceeded')
}

/**
 * Checks the certification status of a submitted batch with SII
 * 
 * Queries SII using the track ID to get the current status of submitted DTEs
 * and updates local records accordingly.
 * 
 * @param restaurantId - UUID of the restaurant
 * @param trackId - Track ID returned by SII during submission
 * @returns Promise resolving to current status information
 */
export async function checkCertificationStatus(
  restaurantId: string,
  trackId: string
): Promise<{ status: string; accepted: boolean; details: string }> {
  const supabase = createAdminClient()
  
  try {
    // Load restaurant data for RUT and environment
    const { data: restaurant, error: restaurantError } = await supabase
      .from('restaurants')
      .select('rut, dte_environment')
      .eq('id', restaurantId)
      .maybeSingle()
      
    if (restaurantError || !restaurant) {
      return { 
        status: 'error', 
        accepted: false, 
        details: 'Restaurant not found' 
      }
    }
    
    // Find emissions with this track_id to determine document types
    const { data: emissions, error: emissionsError } = await supabase
      .from('dte_emissions')
      .select('id, document_type, folio, rut_receptor, razon_receptor, total_amount, emitted_at')
      .eq('restaurant_id', restaurantId)
      .eq('sii_track_id', trackId)
      .eq('is_certification', true)
      
    if (emissionsError || !emissions || emissions.length === 0) {
      return { 
        status: 'error', 
        accepted: false, 
        details: 'No emissions found for this track ID' 
      }
    }
    
    // Determine if this is a boleta or factura batch based on document types
    const isBoleta = emissions.some((e: { document_type: number }) => e.document_type === 39 || e.document_type === 41)
    const isFactura = emissions.some((e: { document_type: number }) => e.document_type !== 39 && e.document_type !== 41)
    
    // Ensure environment is valid
    const environment = (restaurant.dte_environment === 'produccion' ? 'produccion' : 'certificacion') as 'certificacion' | 'produccion'
    
    // Load credentials for authentication
    const { data: credentials, error: credError } = await supabase
      .from('dte_credentials')
      .select('cert_ciphertext, cert_iv, cert_auth_tag, pass_ciphertext, pass_iv, pass_auth_tag')
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
      
    if (credError || !credentials) {
      return { 
        status: 'error', 
        accepted: false, 
        details: 'DTE credentials not found' 
      }
    }
    
    // Decrypt PFX and password
    const pfxBuffer = decrypt({
      ciphertext: credentials.cert_ciphertext,
      iv: credentials.cert_iv,
      authTag: credentials.cert_auth_tag,
    })
    
    const passwordBuffer = decrypt({
      ciphertext: credentials.pass_ciphertext,
      iv: credentials.pass_iv,
      authTag: credentials.pass_auth_tag,
    })
    
    const password = passwordBuffer.toString('utf8')
    
    // Load certificate from PFX
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'))
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)
    
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    
    if (!certBags[forge.pki.oids.certBag] || !keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]) {
      return { 
        status: 'error', 
        accepted: false, 
        details: 'Certificate or private key not found in PFX' 
      }
    }
    
    const certificate = certBags[forge.pki.oids.certBag]?.[0]?.cert
    const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key
    
    if (!certificate || !privateKey) {
      return { 
        status: 'error', 
        accepted: false, 
        details: 'Certificate or private key not found in PFX' 
      }
    }
    
    const privateKeyPem = forge.pki.privateKeyToPem(privateKey)
    
    // Get appropriate SII token
    const tokenResult = isBoleta 
      ? await getSiiToken(privateKeyPem, certificate, environment)
      : await getSiiTokenFactura(privateKeyPem, certificate, environment)
    
    const token = tokenResult.token
    
    if (!token) {
      return { 
        status: 'error', 
        accepted: false, 
        details: 'Failed to get SII authentication token' 
      }
    }
    
    let overallStatus = 'unknown'
    let acceptedCount = 0
    let rejectedCount = 0
    const statusDetails: string[] = []
    
    if (isBoleta) {
      // For boletas, use checkDteStatus with track ID (with retry logic)
      const statusResult = await retryWithBackoff(async () => {
        return await checkDteStatus(
          trackId,
          restaurant.rut,
          token,
          environment
        )
      }, 3)
      
      if (statusResult.success && statusResult.status) {
        overallStatus = statusResult.status
        const isAccepted = statusResult.status.toLowerCase().includes('aceptado') || 
                          statusResult.status.toLowerCase().includes('aprobado')
        
        if (isAccepted) {
          acceptedCount = emissions.length
          // Update all boleta emissions to accepted status
          await supabase
            .from('dte_emissions')
            .update({ 
              status: 'accepted',
              sii_response: { 
                status: statusResult.status,
                checked_at: new Date().toISOString(),
                sii_response: statusResult.sii_response
              }
            })
            .eq('sii_track_id', trackId)
            .eq('restaurant_id', restaurantId)
        } else {
          rejectedCount = emissions.length
          // Update all boleta emissions to rejected status
          await supabase
            .from('dte_emissions')
            .update({ 
              status: 'rejected',
              sii_response: { 
                status: statusResult.status,
                checked_at: new Date().toISOString(),
                sii_response: statusResult.sii_response
              }
            })
            .eq('sii_track_id', trackId)
            .eq('restaurant_id', restaurantId)
        }
        
        statusDetails.push(`Boletas: ${statusResult.status}`)
      } else {
        statusDetails.push(`Boletas: Error checking status - ${statusResult.error || statusResult.message}`)
      }
    }
    
    if (isFactura) {
      // For facturas, use queryEstDteFactura for each individual DTE
      for (const emission of emissions.filter((e: { document_type: number }) => e.document_type !== 39 && e.document_type !== 41)) {
        try {
          // Format emission date for SII query (YYYY-MM-DD)
          const emissionDate = emission.emitted_at ? 
            new Date(emission.emitted_at).toISOString().split('T')[0] : 
            new Date().toISOString().split('T')[0]
            
          const statusResult = await retryWithBackoff(async () => {
            return await queryEstDteFactura({
              rutConsultante: restaurant.rut,
              rutCompania: restaurant.rut,
              rutReceptor: emission.rut_receptor || '96790240-3', // Default test RUT if not available
              tipoDte: emission.document_type,
              folioDte: emission.folio,
              fechaEmisionDte: emissionDate,
              montoDte: emission.total_amount || 0,
              token: token
            }, environment)
          }, 3)
          
          if (statusResult.estado) {
            const isAccepted = statusResult.estado.toLowerCase().includes('aceptado') || 
                              statusResult.estado.toLowerCase().includes('aprobado')
            
            if (isAccepted) {
              acceptedCount++
            } else {
              rejectedCount++
            }
            
            // Update individual emission status
            await supabase
              .from('dte_emissions')
              .update({ 
                status: isAccepted ? 'accepted' : 'rejected',
                sii_response: {
                  estado: statusResult.estado,
                  glosa: statusResult.glosa || null,
                  checked_at: new Date().toISOString()
                }
              })
              .eq('id', emission.id)
              
            statusDetails.push(`DTE ${emission.document_type}-${emission.folio}: ${statusResult.estado}${statusResult.glosa ? ` (${statusResult.glosa})` : ''}`)
          } else if (statusResult.error) {
            statusDetails.push(`DTE ${emission.document_type}-${emission.folio}: Error - ${statusResult.error}`)
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          statusDetails.push(`DTE ${emission.document_type}-${emission.folio}: Error - ${errorMessage}`)
        }
      }
    }
    
    // Determine overall status
    if (acceptedCount > 0 && rejectedCount === 0) {
      overallStatus = 'accepted'
    } else if (rejectedCount > 0 && acceptedCount === 0) {
      overallStatus = 'rejected'
    } else if (acceptedCount > 0 && rejectedCount > 0) {
      overallStatus = 'partial'
    }
    
    // Update test set status if we can determine it
    if (overallStatus === 'accepted') {
      // Find test set associated with these emissions
      const { data: testCases } = await supabase
        .from('test_cases')
        .select('test_set_id')
        .in('emission_id', emissions.map((e: { id: string }) => e.id))
        .limit(1)
        
      if (testCases && testCases.length > 0) {
        await supabase
          .from('test_sets')
          .update({ 
            status: 'approved',
            approved_count: acceptedCount
          })
          .eq('id', testCases[0].test_set_id)
      }
    }
    
    return {
      status: overallStatus,
      accepted: acceptedCount > 0,
      details: statusDetails.join('; ')
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during status check'
    return { 
      status: 'error', 
      accepted: false, 
      details: errorMessage 
    }
  }
}

/**
 * Creates a batch envelope (EnvioBOLETA or EnvioDTE) containing multiple DTEs
 * 
 * @param emissions - Array of emission records with signed XML
 * @param rutEmisor - RUT of the restaurant
 * @param rutEnvia - RUT of the person sending
 * @param isBoleta - Whether this is a boleta envelope (true) or factura envelope (false)
 * @param credentials - DTE credentials for signing
 * @returns Promise resolving to signed envelope XML
 */
async function createBatchEnvelope(
  emissions: Array<{ id: string; document_type: number; folio: number; xml_signed: string }>,
  rutEmisor: string,
  rutEnvia: string,
  isBoleta: boolean,
  credentials: { cert_ciphertext: string; cert_iv: string; cert_auth_tag: string; pass_ciphertext: string; pass_iv: string; pass_auth_tag: string }
): Promise<string> {
  if (emissions.length === 0) {
    throw new Error('No emissions provided for envelope creation')
  }
  
  // Extract signed DTEs from the individual envelopes
  const signedDtes: string[] = []
  const documentCounts: Record<number, number> = {}
  
  for (const emission of emissions) {
    // Extract the signed DTE from the individual envelope
    const dteMatch = /<DTE version="1\.0">([\s\S]*?)<\/DTE>/.exec(emission.xml_signed)
    if (dteMatch) {
      signedDtes.push(dteMatch[0])
      documentCounts[emission.document_type] = (documentCounts[emission.document_type] || 0) + 1
    }
  }
  
  if (signedDtes.length === 0) {
    throw new Error('No valid DTEs found in emissions')
  }
  
  // Create caratula with document type counts
  const subTotDteXml = Object.entries(documentCounts)
    .map(([docType, count]) => 
      `      <SubTotDTE>\n` +
      `        <TpoDTE>${docType}</TpoDTE>\n` +
      `        <NroDTE>${count}</NroDTE>\n` +
      `      </SubTotDTE>`
    )
    .join('\n')
  
  const nowDate = new Date()
  const offsetMs = nowDate.getTimezoneOffset() * 60000
  const tmst = new Date(nowDate.getTime() - offsetMs).toISOString().substring(0, 19)
  
  // Use resolution data for certification environment
  // Official SII test values for certification (numero: 0, fecha: 2026-04-23)
  const RESOLUCION = {
    fecha: '2026-04-23',
    numero: '0'
  }
  const RUT_SII = '60803000-K'
  
  const caratulaXml =
    `<Caratula version="1.0">\n` +
    `      <RutEmisor>${rutEmisor}</RutEmisor>\n` +
    `      <RutEnvia>${rutEnvia}</RutEnvia>\n` +
    `      <RutReceptor>${RUT_SII}</RutReceptor>\n` +
    `      <FchResol>${RESOLUCION.fecha}</FchResol>\n` +
    `      <NroResol>${RESOLUCION.numero}</NroResol>\n` +
    `      <TmstFirmaEnv>${tmst}</TmstFirmaEnv>\n` +
    subTotDteXml + '\n' +
    `    </Caratula>`
  
  const rootTag = isBoleta ? 'EnvioBOLETA' : 'EnvioDTE'
  const xsdName = isBoleta ? 'EnvioBOLETA_v11.xsd' : 'EnvioDTE_v10.xsd'
  const setId = 'LibreDTE_SetDoc'
  
  const unsignedEnvelope =
    `<${rootTag} xmlns="http://www.sii.cl/SiiDte" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:schemaLocation="http://www.sii.cl/SiiDte ${xsdName}" ` +
    `version="1.0">` +
    `<SetDTE ID="${setId}">` +
    caratulaXml +
    signedDtes.join('') +
    `</SetDTE>` +
    `</${rootTag}>`
  
  // Now we need to sign the envelope
  // Decrypt PFX and password
  const pfxBuffer = decrypt({
    ciphertext: credentials.cert_ciphertext,
    iv: credentials.cert_iv,
    authTag: credentials.cert_auth_tag,
  })
  
  const passwordBuffer = decrypt({
    ciphertext: credentials.pass_ciphertext,
    iv: credentials.pass_iv,
    authTag: credentials.pass_auth_tag,
  })
  
  const password = passwordBuffer.toString('utf8')
  
  // Load certificate from PFX
  const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'))
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)
  
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
  
  if (!certBags[forge.pki.oids.certBag] || !keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]) {
    throw new Error('Certificate or private key not found in PFX')
  }
  
  const certificate = certBags[forge.pki.oids.certBag]?.[0]?.cert
  const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key
  
  if (!certificate || !privateKey) {
    throw new Error('Certificate or private key not found in PFX')
  }
  
  const privateKeyPem = forge.pki.privateKeyToPem(privateKey)
  
  // Sign the envelope using similar logic to buildEnvelope but for SetDTE
  const signedEnvelope = signBatchEnvelope(unsignedEnvelope, privateKeyPem, certificate, setId, rootTag, xsdName)
  
  return `<?xml version="1.0" encoding="ISO-8859-1"?>\n${signedEnvelope}`
}

/**
 * Signs a batch envelope containing multiple DTEs
 */
function signBatchEnvelope(
  unsignedEnvelope: string,
  privateKeyPem: string,
  certificate: forge.pki.Certificate,
  setId: string,
  rootTag: string,
  xsdName: string
): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DOMParser } = require('@xmldom/xmldom')
  
  const c14n = new C14nCanonicalization()
  
  // Parse the envelope and canonicalize SetDTE
  const envDoc = new DOMParser().parseFromString(unsignedEnvelope, 'text/xml')
  const setDteEl = envDoc.getElementsByTagName('SetDTE')[0]
  
  // SetDTE inherits xmlns:xsi from the root element
  const setDteAncestorNs = [
    { prefix: 'xsi', namespaceURI: 'http://www.w3.org/2001/XMLSchema-instance' }
  ]
  const canonicalSetDte = c14n.process(setDteEl, { ancestorNamespaces: setDteAncestorNs })
  
  const setDteDigestValue = crypto.createHash('sha1').update(Buffer.from(canonicalSetDte, 'latin1')).digest('base64')
  
  // Create SignedInfo for the envelope signature
  const setDteSignedInfoXmlForSigning =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
    `<Reference URI="#${setId}">` +
    `<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
    `<DigestValue>${setDteDigestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`
  
  // Self-closing version for the XML output
  const setDteSignedInfoXml =
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${setId}">` +
    `<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/></Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${setDteDigestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`
  
  // Sign the SignedInfo
  const setSigner = crypto.createSign('RSA-SHA1')
  setSigner.update(setDteSignedInfoXmlForSigning, 'utf8')
  const setSignatureBytes = setSigner.sign({ key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING })
  const setDteSignatureValue = setSignatureBytes.toString('base64').match(/.{1,64}/g)!.join('\n')
  
  // Create KeyInfo
  const certPem = forge.pki.certificateToPem(certificate)
  const certBody = certPem.replace(/-----[^-]+-----/g, '').replace(/\r?\n/g, '').trim()
  const certWrapped = certBody.match(/.{1,64}/g)?.join('\n') ?? certBody
  
  const rsaKey = forge.pki.privateKeyFromPem(privateKeyPem) as forge.pki.rsa.PrivateKey & {
    n: forge.jsbn.BigInteger; e: forge.jsbn.BigInteger
  }
  const modulusBytes = rsaKey.n.toByteArray()
  const modulusRaw = Buffer.from(
    new Uint8Array(modulusBytes.slice(modulusBytes[0] === 0 ? 1 : 0))
  ).toString('base64')
  const modulus = modulusRaw.match(/.{1,64}/g)?.join('\n') ?? modulusRaw
  const exponent = Buffer.from(new Uint8Array(rsaKey.e.toByteArray())).toString('base64')
  
  const keyInfoXml =
    `<KeyInfo><KeyValue><RSAKeyValue>` +
    `<Modulus>${modulus}</Modulus>` +
    `<Exponent>${exponent}</Exponent>` +
    `</RSAKeyValue></KeyValue>` +
    `<X509Data><X509Certificate>${certWrapped}</X509Certificate></X509Data></KeyInfo>`
  
  // Create the envelope signature
  const envelopeSignatureXml =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    setDteSignedInfoXml +
    `<SignatureValue>${setDteSignatureValue}</SignatureValue>` +
    keyInfoXml +
    `</Signature>`
  
  // Insert signature into envelope
  const signedEnvelope =
    `<${rootTag} xmlns="http://www.sii.cl/SiiDte" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xsi:schemaLocation="http://www.sii.cl/SiiDte ${xsdName}" ` +
    `version="1.0">\n` +
    unsignedEnvelope.match(/<SetDTE[\s\S]*<\/SetDTE>/)?.[0] + '\n' +
    envelopeSignatureXml +
    `</${rootTag}>`
  
  return signedEnvelope
}

/**
 * Submits an envelope to SII using the appropriate endpoint
 */
async function submitEnvelopeToSII(
  envelopeXml: string,
  rutEmisor: string,
  rutEnvia: string,
  environment: string,
  isBoleta: boolean,
  privateKeyPem: string,
  certificate: forge.pki.Certificate
): Promise<{ success: boolean; track_id?: string; error?: string }> {
  try {
    // Get appropriate token
    const tokenResult = isBoleta 
      ? await getSiiToken(privateKeyPem, certificate, environment as 'certificacion' | 'produccion')
      : await getSiiTokenFactura(privateKeyPem, certificate, environment as 'certificacion' | 'produccion')
    
    const token = tokenResult.token
    
    if (!token) {
      return { success: false, error: 'Failed to get SII authentication token' }
    }
    
    // Submit using appropriate function
    const result = isBoleta
      ? await sendDteToSII(envelopeXml, rutEmisor, rutEnvia, token, environment as 'certificacion' | 'produccion')
      : await sendFacturaToSII(envelopeXml, rutEmisor, rutEnvia, token, environment as 'certificacion' | 'produccion')
    
    if (result.success && result.track_id) {
      return { success: true, track_id: result.track_id }
    } else {
      return { success: false, error: result.message || result.error || 'Unknown SII error' }
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during SII submission'
    return { success: false, error: errorMessage }
  }
}