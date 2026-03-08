# Monorepo make targets. Run from repo root.
# Generate all OpenAPI specs: make openapi-all (runs npm run openapi:all)

.PHONY: openapi-all

openapi-all:
	./scripts/generate_all_open_api_files.sh
