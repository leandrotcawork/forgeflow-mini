#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <version>"
  echo "Example: $0 0.4.0"
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

VERSION="$1"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: version must match X.Y.Z (for example: 0.4.0)"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PLUGIN_JSON=".claude-plugin/plugin.json"
MARKETPLACE_JSON=".claude-plugin/marketplace.json"
PACKAGES_JSON="packages.json"
README_MD="README.md"
CHANGELOG_MD="CHANGELOG.md"
TAG="v${VERSION}"

for file in "$PLUGIN_JSON" "$MARKETPLACE_JSON" "$PACKAGES_JSON" "$README_MD" "$CHANGELOG_MD"; do
  if [[ ! -f "$file" ]]; then
    echo "Error: required file not found: $file"
    exit 1
  fi
done

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: tag already exists: $TAG"
  exit 1
fi

python - "$VERSION" <<'PY'
import json
import pathlib
import re
import sys

version = sys.argv[1]
root = pathlib.Path(".")

plugin_path = root / ".claude-plugin" / "plugin.json"
marketplace_path = root / ".claude-plugin" / "marketplace.json"
packages_path = root / "packages.json"
readme_path = root / "README.md"

plugin = json.loads(plugin_path.read_text(encoding="utf-8"))
plugin["version"] = version
plugin_path.write_text(json.dumps(plugin, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

marketplace = json.loads(marketplace_path.read_text(encoding="utf-8"))
marketplace.setdefault("metadata", {})["version"] = version

def with_version_prefix(text: str) -> str:
    prefix = f"v{version} \u2014 "
    if re.match(r"^v\d+\.\d+\.\d+\s+\u2014\s+", text):
        return re.sub(r"^v\d+\.\d+\.\d+\s+\u2014\s+", prefix, text, count=1)
    return prefix + text

if "description" in marketplace["metadata"]:
    marketplace["metadata"]["description"] = with_version_prefix(marketplace["metadata"]["description"])

for plugin_entry in marketplace.get("plugins", []):
    plugin_entry["version"] = version
    if "description" in plugin_entry:
        plugin_entry["description"] = with_version_prefix(plugin_entry["description"])

marketplace_path.write_text(json.dumps(marketplace, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

packages = json.loads(packages_path.read_text(encoding="utf-8"))
packages["version"] = version
packages_path.write_text(json.dumps(packages, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

readme_text = readme_path.read_text(encoding="utf-8")
readme_text = re.sub(r"Version-\d+\.\d+\.\d+-blue", f"Version-{version}-blue", readme_text)
readme_text = re.sub(r'alt="Version \d+\.\d+\.\d+"', f'alt="Version {version}"', readme_text)
readme_text = re.sub(r"Adds v\d+\.\d+\.\d+ features", f"Adds v{version} features", readme_text)
readme_path.write_text(readme_text, encoding="utf-8")

# Update template versions
brain_config = root / "templates" / "brain" / "brain.config.json"
brain_state = root / "templates" / "brain" / "progress" / "brain-project-state.json"

for tpl_path in [brain_config, brain_state]:
    tpl = json.loads(tpl_path.read_text(encoding="utf-8"))
    tpl["version"] = version
    tpl_path.write_text(json.dumps(tpl, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
PY

BRAIN_CONFIG="templates/brain/brain.config.json"
BRAIN_STATE="templates/brain/progress/brain-project-state.json"

# ── Post-update validation ──────────────────────────────────────────
echo ""
echo "── Validation ──"

# Count skills in the skills/ directory
SKILL_COUNT=$(find skills -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')
echo "  Skills on disk: ${SKILL_COUNT}"

# Count skills registered in plugin.json
PLUGIN_SKILL_COUNT=$(python -c "import json; d=json.load(open('$PLUGIN_JSON')); print(len(d.get('claude_code',{}).get('skills',[])))")
echo "  Skills in plugin.json: ${PLUGIN_SKILL_COUNT}"

if [[ "$SKILL_COUNT" != "$PLUGIN_SKILL_COUNT" ]]; then
  echo "  !! WARNING: Skill count mismatch! ${SKILL_COUNT} on disk vs ${PLUGIN_SKILL_COUNT} in plugin.json"
  echo "  !! Update .claude-plugin/plugin.json skills list before releasing."
  exit 1
fi

# Check README badge matches
README_BADGE_COUNT=$(grep -o "Skills-[0-9]*" "$README_MD" | head -1 | grep -o "[0-9]*")
echo "  Skills in README badge: ${README_BADGE_COUNT}"

if [[ "$SKILL_COUNT" != "$README_BADGE_COUNT" ]]; then
  echo "  !! WARNING: README badge says ${README_BADGE_COUNT} but ${SKILL_COUNT} skills exist!"
  exit 1
fi

# Check CHANGELOG has this version
if ! grep -q "\[${VERSION}\]" "$CHANGELOG_MD"; then
  echo "  !! WARNING: CHANGELOG.md has no entry for [${VERSION}]"
  echo "  !! Add a changelog entry before releasing."
  exit 1
fi

# Check no stale versions remain
STALE=$(grep -rn "\"version\": \"" .claude-plugin/ packages.json templates/brain/brain.config.json templates/brain/progress/brain-project-state.json 2>/dev/null | grep -v "$VERSION" || true)
if [[ -n "$STALE" ]]; then
  echo "  !! WARNING: Stale version references found:"
  echo "$STALE"
  exit 1
fi

echo "  All checks passed."
echo ""

# ── Commit, tag, push ───────────────────────────────────────────────
git add "$PLUGIN_JSON" "$MARKETPLACE_JSON" "$PACKAGES_JSON" "$README_MD" "$BRAIN_CONFIG" "$BRAIN_STATE"
git commit -m "chore(release): ${TAG}"
git tag "$TAG"
git push
git push origin "$TAG"

echo ""
echo "Release ${TAG} committed, tagged, and pushed."
