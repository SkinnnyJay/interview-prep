#!/usr/bin/env bash
# Install dependencies in each API subproject. Run from repo root.
# Used by install:all and CI so build:all has all subproject deps (e.g. nextjs-backend).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

for dir in src/api/*/; do
  if [ -f "${dir}package.json" ]; then
    (cd "$dir" && npm install --no-audit --no-fund)
  fi
done
