#!/bin/bash

# Script to migrate existing CAF data to plain text format for PHP bridge
# Run this after applying the schema migration

echo "Migrating CAF data..."

# Get the base URL from environment or use localhost
BASE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"

# Call the migration endpoint
curl -X POST "$BASE_URL/api/dte/caf/migrate" \
  -H "Content-Type: application/json" \
  | jq '.'

echo ""
echo "Migration complete!"
