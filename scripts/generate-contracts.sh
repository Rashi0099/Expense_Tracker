#!/usr/bin/env bash
set -e

echo "Exporting OpenAPI schema from Django..."
# (python backend/manage.py spectacular --file contracts/openapi/v1.yaml)

echo "Generating TypeScript types from OpenAPI..."
# (npx openapi-typescript contracts/openapi/v1.yaml -o contracts/generated/api-types.ts)
