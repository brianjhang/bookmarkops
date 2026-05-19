#!/usr/bin/env bash
# scripts/package-cws-zip.sh — Pattern-allowlist CWS zip packager.
#
# Source:      ../dist/           (must be built first via `npm run build`)
# Destination: ../release/bookmarkops-${VERSION}.zip
#
# Safe-by-default: only files matching the explicit allowlist below are
# copied into the zip. Anything else (.vite/, .DS_Store, .omc/,
# unrelated build artifacts, source maps, non-extension files, etc.) is
# structurally excluded.
#
# Usage:
#   ./scripts/package-cws-zip.sh
#
# This script does NOT push or upload. It produces a zip artifact that
# you then upload to the Chrome Web Store manually.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
OUT_DIR="${ROOT_DIR}/release"

[ -d "$DIST_DIR" ] || { echo "ERROR: dist/ not found. Run 'npm run build' first."; exit 1; }
[ -f "$DIST_DIR/manifest.json" ] || { echo "ERROR: $DIST_DIR/manifest.json missing — build did not complete."; exit 1; }

VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${DIST_DIR}/manifest.json','utf8')).version)")"
ZIP_PATH="${OUT_DIR}/bookmarkops-${VERSION}.zip"

mkdir -p "$OUT_DIR"
rm -f "$ZIP_PATH"

STAGE="$(mktemp -d -t bookmarkops-zip-XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT

# Pattern allowlist — only listed paths are copied into the staging area.
# Each line is a glob relative to dist/. nullglob makes unmatched patterns
# silently no-op (no spurious errors when an optional file is absent).
shopt -s nullglob

copy_glob() {
  local pattern="$1"
  for src in $DIST_DIR/$pattern; do
    [ -e "$src" ] || continue
    local rel="${src#$DIST_DIR/}"
    local destdir="$STAGE/$(dirname "$rel")"
    mkdir -p "$destdir"
    cp "$src" "$STAGE/$rel"
  done
}

# Top-level extension entry points + static assets
copy_glob "manifest.json"
copy_glob "service-worker-loader.js"
copy_glob "*.html"
copy_glob "favicon.svg"
copy_glob "icons.svg"

# Chrome i18n locales (one messages.json per locale dir)
copy_glob "_locales/*/messages.json"

# Compiled JS + CSS bundles
copy_glob "assets/*.js"
copy_glob "assets/*.css"

# Extension icons
copy_glob "icons/icon*.png"
copy_glob "icons/icon.svg"

shopt -u nullglob

# Pack
(cd "$STAGE" && zip -r "$ZIP_PATH" . > /dev/null)

echo "✓ Created: $ZIP_PATH"
echo ""
echo "─── Zip contents ───"
unzip -l "$ZIP_PATH"
