#!/bin/bash

echo "=== SII Response Debug ==="
if [ -f /tmp/sii_response_debug.json ]; then
    cat /tmp/sii_response_debug.json | jq '.'
else
    echo "No SII response file found"
fi

echo ""
echo "=== Generated XML (first 100 lines) ==="
if [ -f /tmp/php_generated_dte.xml ]; then
    head -100 /tmp/php_generated_dte.xml
else
    echo "No generated XML file found"
fi
