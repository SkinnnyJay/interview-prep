#!/usr/bin/env bash
# Generate OpenAPI (openapi.json) for all API modules that support it.
# Run from repo root: ./scripts/generate_all_open_api_files.sh
# Or: make openapi-all | npm run openapi:all

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

PROJECTS=(
  api-scenarios
  autocomplete
  caching
  concurrency-parallel
  dependency-injection
  pagination
  rate-limiter
  search-algorithms
  security
  validation
)

for project in "${PROJECTS[@]}"; do
  echo "==> Generating OpenAPI for $project ..."
  npm run "${project}:openapi"
done

echo "==> All OpenAPI files generated."
