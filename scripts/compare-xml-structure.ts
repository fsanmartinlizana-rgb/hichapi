import * as fs from 'fs'

/**
 * Script para comparar la estructura de dos XMLs de DTE
 * 
 * Uso: npx tsx scripts/compare-xml-structure.ts <xml_nodejs> <xml_php>
 */
function compareXmlStructure() {
  const nodeXmlPath = process.argv[2]
  const phpXmlPath = process.argv[3]

  if (!nodeXmlPath || !phpXmlPath) {
    console.error('❌ Error: Debes proveer dos rutas de archivos XML.')
    console.error('Ejemplo: npx tsx scripts/compare-xml-structure.ts /tmp/dte_node.xml /tmp/dte_php.xml')
    process.exit(1)
  }

  if (!fs.existsSync(nodeXmlPath)) {
    console.error(`❌ Error: No se encuentra el archivo ${nodeXmlPath}`)
    process.exit(1)
  }

  if (!fs.existsSync(phpXmlPath)) {
    console.error(`❌ Error: No se encuentra el archivo ${phpXmlPath}`)
    process.exit(1)
  }

  const nodeXml = fs.readFileSync(nodeXmlPath, 'utf8')
  const phpXml = fs.readFileSync(phpXmlPath, 'utf8')

  console.log('\n🔍 COMPARACIÓN DE ESTRUCTURA XML\n')
  console.log(`Node.js: ${nodeXmlPath}`)
  console.log(`PHP:     ${phpXmlPath}\n`)

  // Extraer elementos clave
  const elements = [
    'TipoDTE',
    'Folio',
    'FchEmis',
    'TpoTranVenta',
    'FmaPago',
    'IndServicio',
    'RUTEmisor',
    'RznSoc',
    'GiroEmis',
    'Acteco',
    'DirOrigen',
    'CmnaOrigen',
    'RUTRecep',
    'RznSocRecep',
    'GiroRecep',
    'DirRecep',
    'CmnaRecep',
    'MntNeto',
    'TasaIVA',
    'IVA',
    'MntTotal',
    'MntExe',
    'PrcItem',
    'MontoItem',
    'RutEmisor',
    'RutEnvia',
    'RutReceptor',
    'FchResol',
    'NroResol',
  ]

  console.log('📊 COMPARACIÓN DE CAMPOS:\n')
  
  for (const elem of elements) {
    const nodeMatch = new RegExp(`<${elem}>([^<]*)<\/${elem}>`).exec(nodeXml)
    const phpMatch = new RegExp(`<${elem}>([^<]*)<\/${elem}>`).exec(phpXml)
    
    const nodeValue = nodeMatch ? nodeMatch[1] : '(no encontrado)'
    const phpValue = phpMatch ? phpMatch[1] : '(no encontrado)'
    
    const match = nodeValue === phpValue ? '✅' : '❌'
    
    console.log(`${match} ${elem}:`)
    console.log(`   Node.js: ${nodeValue}`)
    console.log(`   PHP:     ${phpValue}`)
    
    if (nodeValue !== phpValue) {
      console.log(`   ⚠️  DIFERENCIA DETECTADA`)
    }
    console.log()
  }

  // Verificar estructura del TED
  console.log('📊 ESTRUCTURA DEL TED:\n')
  
  const nodeTedMatch = /<TED[\s\S]*?<\/TED>/.exec(nodeXml)
  const phpTedMatch = /<TED[\s\S]*?<\/TED>/.exec(phpXml)
  
  console.log(`Node.js TED: ${nodeTedMatch ? '✅ Encontrado' : '❌ No encontrado'}`)
  console.log(`PHP TED:     ${phpTedMatch ? '✅ Encontrado' : '❌ No encontrado'}\n`)
  
  if (nodeTedMatch && phpTedMatch) {
    const nodeTed = nodeTedMatch[0]
    const phpTed = phpTedMatch[0]
    
    // Verificar elementos del TED
    const tedElements = ['RE', 'TD', 'F', 'FE', 'RR', 'RSR', 'MNT', 'IT1', 'TSTED']
    
    for (const elem of tedElements) {
      const nodeMatch = new RegExp(`<${elem}>([^<]*)<\/${elem}>`).exec(nodeTed)
      const phpMatch = new RegExp(`<${elem}>([^<]*)<\/${elem}>`).exec(phpTed)
      
      const nodeValue = nodeMatch ? nodeMatch[1] : '(no encontrado)'
      const phpValue = phpMatch ? phpMatch[1] : '(no encontrado)'
      
      const match = nodeValue === phpValue ? '✅' : '❌'
      
      console.log(`${match} TED/${elem}: Node="${nodeValue}" PHP="${phpValue}"`)
    }
    
    // Verificar CAF en TED
    const nodeCafMatch = /<CAF[\s\S]*?<\/CAF>/.exec(nodeTed)
    const phpCafMatch = /<CAF[\s\S]*?<\/CAF>/.exec(phpTed)
    
    console.log(`\n${nodeCafMatch ? '✅' : '❌'} Node.js tiene bloque CAF en TED`)
    console.log(`${phpCafMatch ? '✅' : '❌'} PHP tiene bloque CAF en TED`)
    
    // Verificar FRMT
    const nodeFrmtMatch = /<FRMT[^>]*>([^<]*)<\/FRMT>/.exec(nodeTed)
    const phpFrmtMatch = /<FRMT[^>]*>([^<]*)<\/FRMT>/.exec(phpTed)
    
    console.log(`\n${nodeFrmtMatch ? '✅' : '❌'} Node.js tiene FRMT en TED (${nodeFrmtMatch?.[1].length || 0} chars)`)
    console.log(`${phpFrmtMatch ? '✅' : '❌'} PHP tiene FRMT en TED (${phpFrmtMatch?.[1].length || 0} chars)`)
  }

  // Verificar firmas
  console.log('\n📊 FIRMAS:\n')
  
  const nodeSignatures = nodeXml.match(/<Signature[\s\S]*?<\/Signature>/g) || []
  const phpSignatures = phpXml.match(/<Signature[\s\S]*?<\/Signature>/g) || []
  
  console.log(`Node.js: ${nodeSignatures.length} firmas encontradas`)
  console.log(`PHP:     ${phpSignatures.length} firmas encontradas`)
  
  if (nodeSignatures.length === phpSignatures.length) {
    console.log(`✅ Mismo número de firmas\n`)
  } else {
    console.log(`❌ Diferente número de firmas\n`)
  }

  // Verificar encoding
  console.log('📊 ENCODING:\n')
  
  const nodeEncoding = /encoding="([^"]+)"/.exec(nodeXml)?.[1] || 'no especificado'
  const phpEncoding = /encoding="([^"]+)"/.exec(phpXml)?.[1] || 'no especificado'
  
  console.log(`Node.js: ${nodeEncoding}`)
  console.log(`PHP:     ${phpEncoding}`)
  console.log(`${nodeEncoding === phpEncoding ? '✅' : '❌'} Encoding ${nodeEncoding === phpEncoding ? 'coincide' : 'difiere'}\n`)

  // Verificar namespace
  console.log('📊 NAMESPACES:\n')
  
  const nodeNs = /xmlns="([^"]+)"/.exec(nodeXml)?.[1] || 'no especificado'
  const phpNs = /xmlns="([^"]+)"/.exec(phpXml)?.[1] || 'no especificado'
  
  console.log(`Node.js: ${nodeNs}`)
  console.log(`PHP:     ${phpNs}`)
  console.log(`${nodeNs === phpNs ? '✅' : '❌'} Namespace ${nodeNs === phpNs ? 'coincide' : 'difiere'}\n`)

  console.log('✅ COMPARACIÓN COMPLETADA\n')
}

compareXmlStructure()
