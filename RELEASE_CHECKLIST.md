# Release Checklist

Use this checklist before every release. The release script (`scripts/release.sh`) automates version bumps and validation, but these manual checks ensure nothing is missed.

## Before Running release.sh

### 1. Version References (7 files)

All must show the same version number:

| File | Field | Auto-updated by release.sh? |
|---|---|---|
| `.claude-plugin/plugin.json` | `"version"` | Yes |
| `.claude-plugin/marketplace.json` | `metadata.version` + `plugins[0].version` | Yes |
| `packages.json` | `"version"` | Yes |
| `README.md` | Badge `Version-X.Y.Z-blue` | Yes |
| `templates/brain/brain.config.json` | `"version"` | Yes |
| `templates/brain/progress/brain-project-state.json` | `"version"` | Yes |
| `CHANGELOG.md` | `## [X.Y.Z]` entry | **No -- write manually** |

### 2. Skill Count Consistency (4 locations)

When adding or removing skills, ALL of these must match:

| Location | What to check |
|---|---|
| `skills/` directory | Count subdirectories (`ls skills/`) |
| `.claude-plugin/plugin.json` | `claude_code.skills` array length |
| `README.md` badge | `Skills-N-orange` |
| `README.md` Skill Map | `### Skill Map (N Skills)` table row count |

### 3. Descriptions (3 files)

When changing plugin capabilities, update descriptions in:

| File | Field |
|---|---|
| `.claude-plugin/plugin.json` | `"description"` (top-level) |
| `.claude-plugin/marketplace.json` | `metadata.description` + `plugins[0].description` |
| `packages.json` | `"description"` |

### 4. New Skills Registration

When adding a new skill:

- [ ] Create `skills/<skill-name>/SKILL.md`
- [ ] Add entry to `.claude-plugin/plugin.json` `claude_code.skills` array
- [ ] Add row to README "Which Skill?" table
- [ ] Add row to README "Skill Map" table
- [ ] Update skill count in README badge and Skill Map header
- [ ] Update descriptions in all 3 files (plugin.json, marketplace.json, packages.json)
- [ ] Add CHANGELOG entry

### 5. CHANGELOG

- [ ] New `## [X.Y.Z] - YYYY-MM-DD` section at top
- [ ] All Added/Changed/Fixed items documented
- [ ] Version order is descending (newest first)

## Running the Release

```bash
# From repo root:
bash scripts/release.sh 0.7.0
```

The script will:
1. Validate all required files exist
2. Check tag doesn't already exist
3. Update version in all 7 files
4. Prefix descriptions with version
5. Update template versions
6. **Validate**: skill count matches across disk/plugin.json/README
7. **Validate**: CHANGELOG has entry for this version
8. **Validate**: no stale version references remain
9. Commit, tag, and push

## After Releasing

- [ ] Verify on GitHub that the tag exists
- [ ] Reinstall plugin locally to test marketplace description
- [ ] Run `/brain-init --upgrade` on a test project to verify templates

## Common Mistakes

| Mistake | How to avoid |
|---|---|
| Forgot to update plugin.json skills list | release.sh now validates skill count |
| Descriptions still say old skill count | Update descriptions BEFORE running release.sh |
| CHANGELOG missing | release.sh blocks if no `[X.Y.Z]` entry exists |
| Templates have old version | release.sh auto-updates templates |
| Committed without running release.sh | Always use release.sh for version bumps |
| README badge updated but Skill Map not | release.sh validates badge count vs disk |
