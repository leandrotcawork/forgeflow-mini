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
TAG="v${VERSION}"

for file in "$PLUGIN_JSON" "$MARKETPLACE_JSON" "$PACKAGES_JSON" "$README_MD"; do
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

git add "$PLUGIN_JSON" "$MARKETPLACE_JSON" "$PACKAGES_JSON" "$README_MD" "$BRAIN_CONFIG" "$BRAIN_STATE"
git commit -m "chore(release): ${TAG}"
git tag "$TAG"
git push
git push origin "$TAG"

echo "Release updated and pushed: ${TAG}"
