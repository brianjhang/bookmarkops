#!/usr/bin/env bash
# scripts/sync-public.sh — Generate the public bookmarkops repo from internal.
#
# Source of truth: bookmarkops-internal/
# Target:          ../bookmarkops/  (must already be a git repo, can be empty)
#
# Usage:
#   ./scripts/sync-public.sh --dry-run    # preview only, no writes
#   ./scripts/sync-public.sh              # sync + create squash commit (no push)
#
# This script NEVER pushes. Review the commit, then push manually.

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=true; fi

INTERNAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLIC_DIR="${INTERNAL_DIR}/../bookmarkops"
MANIFEST="${INTERNAL_DIR}/public-manifest.txt"
PKG_TEMPLATE="${INTERNAL_DIR}/package.json.public"
IGNORE_TEMPLATE="${INTERNAL_DIR}/.gitignore.public"
README_TEMPLATES=(README.md.public README.zh-TW.md.public README.zh-CN.md.public)

[ -f "$MANIFEST"        ] || { echo "ERROR: whitelist not found: $MANIFEST"; exit 1; }
[ -f "$PKG_TEMPLATE"    ] || { echo "ERROR: package.json template not found: $PKG_TEMPLATE"; exit 1; }
[ -f "$IGNORE_TEMPLATE" ] || { echo "ERROR: .gitignore template not found: $IGNORE_TEMPLATE"; exit 1; }
for t in "${README_TEMPLATES[@]}"; do
  [ -f "$INTERNAL_DIR/$t" ] || { echo "ERROR: README template not found: $INTERNAL_DIR/$t"; exit 1; }
done
[ -d "$PUBLIC_DIR"      ] || { echo "ERROR: public dir not found: $PUBLIC_DIR"; exit 1; }
[ -d "$PUBLIC_DIR/.git" ] || { echo "ERROR: $PUBLIC_DIR is not a git repo (run 'git init' there first)"; exit 1; }

VERSION="$(node -e "console.log(JSON.parse(require('fs').readFileSync('${PKG_TEMPLATE}', 'utf8')).version)")"

echo "═════════════════════════════════════════════════════════════"
echo " BookmarkOps public sync"
echo "─────────────────────────────────────────────────────────────"
echo " Internal:   $INTERNAL_DIR"
echo " Public:     $PUBLIC_DIR"
echo " Version:    v$VERSION  (from package.json.public)"
echo " Mode:       $([ "$DRY_RUN" = true ] && echo 'DRY RUN (no writes)' || echo 'SYNC + COMMIT (no push)')"
echo "═════════════════════════════════════════════════════════════"
echo ""

# Read whitelist into array (skip comments / blank lines)
PATHS=()
while IFS= read -r line; do
  trimmed="${line%%#*}"                                                # strip inline comment
  trimmed="${trimmed#"${trimmed%%[![:space:]]*}"}"                    # ltrim
  trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"                    # rtrim
  [[ -z "$trimmed" ]] && continue
  PATHS+=("$trimmed")
done < "$MANIFEST"

echo "─── Whitelisted paths (${#PATHS[@]}) ─────────────────────────"
for p in "${PATHS[@]}"; do
  if [ -e "$INTERNAL_DIR/$p" ]; then
    echo "  + $p"
  else
    echo "  ! MISSING (skipping): $p"
  fi
done
echo ""

# Patterns to exclude when copying internal → snapshot.
# Covers OS junk, build artefacts, editor state, AI tool state, env / signing.
EXCLUDE_ARGS=(
  --exclude=".DS_Store"
  --exclude="Thumbs.db"
  --exclude="node_modules/"
  --exclude="dist/"
  --exclude=".vite/"
  --exclude=".omc/"
  --exclude=".claude/"
  --exclude=".codex/"
  --exclude=".agents/"
  --exclude=".gstack/"
  --exclude=".omx/"
  --exclude="*.log"
  --exclude="*.local"
  --exclude=".env"
  --exclude=".env.*"
  --exclude="*.pem"
  --exclude=".vscode/"
  --exclude=".idea/"
)

# Build a temp snapshot of whitelisted content, then rsync --delete to public.
SNAPSHOT="$(mktemp -d -t bookmarkops-sync-XXXXXX)"
trap 'rm -rf "$SNAPSHOT"' EXIT

for p in "${PATHS[@]}"; do
  p="${p%/}"                                  # strip trailing slash for portable handling
  if [ ! -e "$INTERNAL_DIR/$p" ]; then continue; fi
  parent_dir="$SNAPSHOT/$(dirname "$p")"
  mkdir -p "$parent_dir"
  # rsync without trailing slash on source = include the directory wrapper itself.
  # Same call works for files and directories — keeps snapshot + mirror semantics aligned.
  rsync -a "${EXCLUDE_ARGS[@]}" "$INTERNAL_DIR/$p" "$parent_dir/"
done

# Apply templates (overrides what was synced)
cp "$PKG_TEMPLATE"    "$SNAPSHOT/package.json"
cp "$IGNORE_TEMPLATE" "$SNAPSHOT/.gitignore"

# Public-facing README templates strip internal references (v2-roadmap,
# ai-doorway, internal docs paths). They override the internal-canonical
# READMEs that may legitimately reference internal-only material.
for t in "${README_TEMPLATES[@]}"; do
  target_name="${t%.public}"          # README.md.public → README.md
  cp "$INTERNAL_DIR/$t" "$SNAPSHOT/$target_name"
done

# ─── Content leak gate ────────────────────────────────────────
# Scan snapshot for forbidden internal references AFTER templates applied.
# Each pattern must be a precise string that uniquely identifies internal-only
# content. Patterns are matched literally with `grep -F`. Avoid generic words
# like "v2" / "openspec" that have legitimate public uses.
LEAK_PATTERNS=(
  'v2-roadmap'                       # internal-only docs subdir
  'ai-doorway'                       # internal parallel track code name
  '/Users/brian/'                    # personal absolute path leak
  'docs/audits/'                     # internal audit dir
  'docs/release/'                    # internal release dir
  'docs/launch/'                     # internal launch dir
  'docs/archive/'                    # internal archive dir
  'docs/project-structure.md'        # internal project-structure doc
  'forgejo'                          # internal hosting infra
  'vibe-switch'                      # adjacent internal project
  'ai-commerce-os'                   # adjacent internal project
  'ServerAdmin'                      # parent dir name on dev machine
  'workbench launcher'               # v2 concept phrase (English)
  '工作台啟動器'                       # v2 concept phrase (繁中)
  '工作台启动器'                       # v2 concept phrase (简中)
)
# Excluded from scan: the gate's own source code (it must contain the patterns
# it's checking for, by definition).
echo "─── Content leak gate(scanning snapshot)─────────────────────"
LEAK_HITS_FILE="$(mktemp -t bookmarkops-leak-XXXXXX)"
for pat in "${LEAK_PATTERNS[@]}"; do
  grep -rIn -F --exclude='sync-public.sh' -- "$pat" "$SNAPSHOT" >> "$LEAK_HITS_FILE" 2>/dev/null || true
done

if [ -s "$LEAK_HITS_FILE" ]; then
  echo "🚫 Content leak gate FAILED — forbidden internal references found in snapshot:"
  echo ""
  cat "$LEAK_HITS_FILE"
  rm -f "$LEAK_HITS_FILE"
  echo ""
  echo "Fix the source (or sanitize via *.public templates) and re-run. No commit, no push."
  exit 1
fi
rm -f "$LEAK_HITS_FILE"
echo "✓ Content leak gate passed (no forbidden patterns in snapshot)."
echo ""

echo "─── rsync preview (mirror snapshot → public, preserving .git) ─"
RSYNC_ARGS=(-a --delete --exclude="/.git/" --exclude="/.git")
if [ "$DRY_RUN" = true ]; then
  rsync "${RSYNC_ARGS[@]}" --dry-run --itemize-changes "$SNAPSHOT/" "$PUBLIC_DIR/"
  echo ""
  echo "── DRY RUN complete. No files written. ──"
  exit 0
fi

echo "─── Mirroring into $PUBLIC_DIR ────────────────────────────────"
rsync "${RSYNC_ARGS[@]}" "$SNAPSHOT/" "$PUBLIC_DIR/"

echo ""
echo "─── Staging all changes in public ────────────────────────────"
( cd "$PUBLIC_DIR" && git add -A )

echo ""
echo "─── git status in public ─────────────────────────────────────"
( cd "$PUBLIC_DIR" && git status --short )
echo ""

# Check the staged diff — covers both fresh repo (everything untracked then staged)
# and re-sync (mix of modified / new / deleted, all staged by `git add -A`).
if ( cd "$PUBLIC_DIR" && git diff --cached --quiet ); then
  echo "── No changes to commit (working tree already matches). ──"
  exit 0
fi

echo "─── Creating squash commit ──────────────────────────────────"
# Pin public release author identity here — do NOT rely on the host's git
# global config. The public-facing identity is the unified project address
# (brianjhang.ai@gmail.com), distinct from any per-agent / internal committer.
git -C "$PUBLIC_DIR" \
  -c user.name="Brian Jhang" \
  -c user.email="brianjhang.ai@gmail.com" \
  commit \
    --author="Brian Jhang <brianjhang.ai@gmail.com>" \
    -m "Release v${VERSION}"

echo ""
echo "═════════════════════════════════════════════════════════════"
echo " ✓ SYNC + COMMIT COMPLETE"
echo "─────────────────────────────────────────────────────────────"
echo " The squash commit is in $PUBLIC_DIR but NOT pushed."
echo ""
echo " Next steps (manual):"
echo "   1) cd $PUBLIC_DIR"
echo "   2) git log -1                              # verify the commit"
echo "   3) git show --stat HEAD                    # eyeball file list"
echo "   4) git remote -v                           # verify the public remote URL"
echo "   5) git push origin main                    # YOU push, not this script"
echo "═════════════════════════════════════════════════════════════"
