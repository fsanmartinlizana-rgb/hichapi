<?php
/**
 * Script para generar una factura de prueba con LibreDTE PHP
 * y guardar el XML resultante para comparar con Node.js
 * 
 * Uso: php scripts/generar_factura_php.php
 * Output: /tmp/factura_php.xml
 */

// Ajusta estas rutas según tu instalación
$base = '/var/www/labodega.cl/APISII';
include $base . '/config.php';
require_once $base . '/Clases/SII/Autenticacion.php';
require_once $base . '/Clases/SII/Folios.php';
require_once $base . '/Clases/FirmaElectronica.php';
require_once $base . '/Clases/I18n.php';
require_once $base . '/Clases/EnvioBoleta.php';
require_once $base . '/Clases/Estado.php';
require_once $base . '/Clases/Sii.php';
require_once $base . '/Clases/Arreglo.php';
require_once $base . '/Clases/Log.php';
require_once $base . '/Clases/SII/DteFactura.php';
require_once $base . '/Clases/SII/Dte/PDF/DtePdf.php';
require_once $base . '/Clases/SII/EnvioDte.php';

$datos   = get_datos();
$config  = get_firma3();
$Firma   = new FirmaElectronica($config['firma']);
$caratula = set_caratula($datos['caratulaFactura']);
$emisor   = set_emisor($datos['emisor']);

// Folio de prueba — usa uno que no hayas consumido
$folio = 99; // CAMBIAR a un folio disponible
$xmlPath = $base . '/xml/empresas/labodega/factura/' . get_xml_by_folio_factura($folio, $datos['datos']['rut']);

// Producto de prueba simple
$productos = [
    [
        'nombre'     => 'Consumo de prueba factura',
        'cantidad'   => 1,
        'precio'     => 11900,  // BRUTO
        'exento'     => false,
        'familia_id' => null,
    ]
];

// Cliente de prueba
$cliente = [
    'rut'          => '60803000-K',
    'razon_social' => 'Servicio de Impuestos Internos',
    'giro'         => 'Organismo Publico',
    'direccion'    => 'Teatinos 120',
    'comuna'       => 'Santiago',
];

// Generar DTE
include_once $base . '/manejo_folios_factura.php';
[$DTE, $caratulaDoc, $montoTotal] = generar_dte_factura($productos, $cliente, $folio, 0, 1);

$Folios = new Folios(file_get_contents($xmlPath));

if (!$DTE->timbrar($Folios)) {
    die("❌ Error al timbrar\n");
}
if (!$DTE->firmar($Firma)) {
    die("❌ Error al firmar\n");
}

$EnvioDTE = new EnvioDte();
$EnvioDTE->agregar($DTE);
$EnvioDTE->setCaratula($caratula);
$EnvioDTE->setFirma($Firma);

$xml = $EnvioDTE->generar();

file_put_contents('/tmp/factura_php.xml', $xml);
echo "✅ XML guardado en /tmp/factura_php.xml\n";
echo "   Folio: $folio\n";
echo "   Monto: $montoTotal\n";
