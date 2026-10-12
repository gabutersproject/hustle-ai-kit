#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/bundle-engine.mjs

stash=""
if [ -d app/api ]; then
  stash="$(mktemp -d)"
  mv app/api "$stash/api"
fi
cleanup() {
  if [ -n "$stash" ] && [ -d "$stash/api" ]; then
    mv "$stash/api" app/api
    rmdir "$stash" 2>/dev/null || true
  fi
}
trap cleanup EXIT

SAWHORSE_EXPORT=1 NEXT_PUBLIC_SAWHORSE_RUNTIME=browser pnpm exec next build
