/**
 * Script para explicar los códigos de estado del SII
 * 
 * Uso: npx tsx scripts/explain-sii-status.ts <codigo>
 */

const SII_STATUS_CODES: Record<string, { name: string; description: string; severity: 'success' | 'warning' | 'error' }> = {
  // Estados de recepción
  'REC': {
    name: 'Recibido',
    description: 'El DTE fue recibido correctamente por el SII y está en proceso de validación.',
    severity: 'success'
  },
  'EPR': {
    name: 'En Proceso',
    description: 'El DTE está siendo procesado por el SII.',
    severity: 'warning'
  },
  'RPR': {
    name: 'Reparo',
    description: 'El DTE tiene reparos que deben ser corregidos.',
    severity: 'warning'
  },
  'RCT': {
    name: 'Rechazado Temporal',
    description: 'El DTE fue rechazado temporalmente. Puede reintentarse.',
    severity: 'error'
  },
  'RFR': {
    name: 'Rechazado por Forma',
    description: 'El DTE fue rechazado por errores de formato o estructura. Común en certificación.',
    severity: 'error'
  },
  'RCH': {
    name: 'Rechazado',
    description: 'El DTE fue rechazado definitivamente.',
    severity: 'error'
  },
  'RSC': {
    name: 'Rechazado por Schema',
    description: 'El DTE no cumple con el schema XSD del SII.',
    severity: 'error'
  },
  'ACE': {
    name: 'Aceptado',
    description: 'El DTE fue aceptado por el SII.',
    severity: 'success'
  },
  'ACD': {
    name: 'Aceptado con Discrepancias',
    description: 'El DTE fue aceptado pero tiene discrepancias menores.',
    severity: 'warning'
  },
  'RLV': {
    name: 'Rechazado por Lote Vencido',
    description: 'El lote de DTEs venció antes de ser procesado.',
    severity: 'error'
  },
  'RFP': {
    name: 'Rechazado por Firma',
    description: 'La firma digital del DTE es inválida.',
    severity: 'error'
  },
}

const COMMON_RFR_CAUSES = [
  {
    issue: 'Fecha de resolución incorrecta',
    solution: 'Verifica que FchResol y NroResol en la Carátula coincidan con tu resolución real del SII'
  },
  {
    issue: 'Datos del emisor incompletos o incorrectos',
    solution: 'Verifica que RUT, razón social, giro, dirección y comuna sean exactos'
  },
  {
    issue: 'Formato de texto incorrecto',
    solution: 'Asegúrate de que todos los textos estén en ISO-8859-1 y sin caracteres especiales no permitidos'
  },
  {
    issue: 'Campos requeridos faltantes',
    solution: 'Verifica que todos los campos obligatorios estén presentes según el tipo de documento'
  },
  {
    issue: 'Montos incorrectos',
    solution: 'Verifica que MntNeto + IVA = MntTotal y que los cálculos sean correctos'
  },
  {
    issue: 'Folio fuera de rango',
    solution: 'Verifica que el folio esté dentro del rango autorizado en el CAF'
  },
  {
    issue: 'Fecha de emisión inválida',
    solution: 'La fecha de emisión debe estar en formato YYYY-MM-DD y no puede ser futura'
  },
  {
    issue: 'RUT receptor inválido',
    solution: 'Para boletas sin RUT, usa 66666666-6. Para facturas, usa un RUT válido'
  },
]

function explainStatus() {
  const code = process.argv[2]?.toUpperCase()

  if (!code) {
    console.log('\n📚 CÓDIGOS DE ESTADO DEL SII\n')
    console.log('Uso: npx tsx scripts/explain-sii-status.ts <codigo>\n')
    console.log('Códigos disponibles:\n')
    
    for (const [key, value] of Object.entries(SII_STATUS_CODES)) {
      const icon = value.severity === 'success' ? '✅' : value.severity === 'warning' ? '⚠️' : '❌'
      console.log(`${icon} ${key.padEnd(5)} - ${value.name}`)
    }
    
    console.log('\nEjemplo: npx tsx scripts/explain-sii-status.ts RFR\n')
    return
  }

  const status = SII_STATUS_CODES[code]

  if (!status) {
    console.log(`\n❌ Código desconocido: ${code}\n`)
    console.log('Códigos válidos:', Object.keys(SII_STATUS_CODES).join(', '))
    console.log('\n')
    return
  }

  const icon = status.severity === 'success' ? '✅' : status.severity === 'warning' ? '⚠️' : '❌'

  console.log(`\n${icon} ESTADO: ${code} - ${status.name}\n`)
  console.log(`📝 Descripción: ${status.description}\n`)

  if (code === 'RFR') {
    console.log('🔍 CAUSAS COMUNES DE RFR (Rechazado por Forma):\n')
    
    COMMON_RFR_CAUSES.forEach((cause, index) => {
      console.log(`${index + 1}. ${cause.issue}`)
      console.log(`   💡 Solución: ${cause.solution}\n`)
    })

    console.log('🛠️  PASOS PARA DIAGNOSTICAR:\n')
    console.log('1. Ejecuta el script de diagnóstico:')
    console.log('   npx tsx scripts/diagnose-dte-signing.ts <restaurant_id>\n')
    console.log('2. Revisa el XML generado en /tmp/dte_diagnostic_*.xml\n')
    console.log('3. Compara con un XML exitoso de PHP (si tienes uno):')
    console.log('   npx tsx scripts/compare-xml-structure.ts <xml_node> <xml_php>\n')
    console.log('4. Verifica la resolución SII en lib/dte/signer.ts línea 42\n')
    console.log('5. Consulta el detalle del rechazo en el portal del SII\n')
  }

  if (code === 'RFP') {
    console.log('🔍 CAUSAS COMUNES DE RFP (Rechazado por Firma):\n')
    console.log('1. Certificado expirado o inválido')
    console.log('   💡 Verifica la fecha de validez del certificado\n')
    console.log('2. Clave privada del CAF incorrecta')
    console.log('   💡 Verifica que el CAF esté correctamente cargado\n')
    console.log('3. Firma del TED inválida')
    console.log('   💡 Verifica que el FRMT esté firmado con la clave del CAF\n')
    console.log('4. Canonicalización incorrecta')
    console.log('   💡 Verifica que se use C14N correctamente\n')
  }

  if (code === 'RSC') {
    console.log('🔍 CAUSAS COMUNES DE RSC (Rechazado por Schema):\n')
    console.log('1. Estructura XML no conforme al XSD')
    console.log('   💡 Verifica que el XML cumpla con EnvioBOLETA_v11.xsd o EnvioDTE_v10.xsd\n')
    console.log('2. Elementos en orden incorrecto')
    console.log('   💡 El orden de los elementos debe ser exacto según el XSD\n')
    console.log('3. Atributos faltantes o incorrectos')
    console.log('   💡 Verifica version="1.0" y otros atributos requeridos\n')
  }

  if (status.severity === 'success') {
    console.log('🎉 ¡Felicitaciones! El DTE fue procesado exitosamente.\n')
  }

  if (status.severity === 'warning') {
    console.log('⚠️  Atención: Revisa los detalles para asegurar que todo esté correcto.\n')
  }

  if (status.severity === 'error') {
    console.log('❌ Error: El DTE fue rechazado. Revisa los detalles y corrige antes de reintentar.\n')
  }
}

explainStatus()
