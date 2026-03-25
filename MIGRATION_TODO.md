# ForgeFlow Mini — Migration TODO (Phase 5 Completion)

**Status:** Plugin functional but mid-transition. Architecture > Implementation.

**Codex Review:** 2026-03-25

---

## Critical Issues to Address

### 1. ❌ Non-existent Skills in Documentation

These are documented but do NOT exist in skills/:
- `/brain-adr` — referenced in README, GETTING_STARTED, CLAUDE.md
- `/brain-graph` — referenced in README, GETTING_STARTED

**Action:** Remove from docs (Phase 6 features, not yet implemented)

---

### 2. ❌ scripts/init.js References Non-existent scripts/index.js

**Problem:**
init.js says: "To build brain.db, run: node scripts/index.js"

But scripts/index.js does not exist.

**Fix:** Update to use correct builder (`build_brain_db.py`)

---

### 3. ❌ Directory Structure Still Uses Flat Lessons Model

**Current (wrong):**
```
.brain/
├── lessons/
│   └── lesson-0001.md    ← Flat
```

**Should create:**
```
.brain/
├── cortex/
│   ├── backend/lessons/
│   ├── frontend/lessons/
│   ├── database/lessons/
│   └── infra/lessons/
├── lessons/
│   ├── cross-domain/
│   ├── inbox/
│   └── archived/
```

---

### 4. ❌ brain.db Index Missing Domain Context

**Current:** Stores lessons with `region='lessons'` (too generic)

**Should:** Add `domain` column to index by domain

---

### 5. ❌ brain-lesson.md Lifecycle Model Incomplete

Current frontmatter is weak:
```yaml
escalated: false  ← Boolean, too simplistic
```

Should track:
```yaml
status: inbox            # inbox → candidate → approved → convention
promotion_candidate: true
domain: backend          # or ['backend', 'frontend']
```

---

## Priority Fix Order

### Phase 5.1 (Quick) — 30 min
- [ ] Remove /brain-adr from README, GETTING_STARTED, CLAUDE.md
- [ ] Remove /brain-graph from docs
- [ ] Fix scripts/init.js reference

### Phase 5.2 (Init) — 2 hours
- [ ] Update scripts/init.js to create distributed lesson dirs
- [ ] Update templates/brain/ structure
- [ ] Test end-to-end

### Phase 5.3 (Index) — 1 hour
- [ ] Update brain.db schema (add domain column)
- [ ] Update build_brain_db.py to extract domain from path

### Phase 5.4 (Skills) — 2 hours
- [ ] Update brain-lesson.md with new lifecycle
- [ ] Update brain-consolidate.md to respect domains
- [ ] Update brain-map.md to load domain-specific lessons

### Phase 5.5 (Docs) — 1 hour
- [ ] Update all docs to use distributed lesson language
- [ ] Remove flat-model references

---

## Test Criteria (Done When)

- ✅ `/forgeflow-mini:brain-task` works end-to-end
- ✅ All 11 skills appear when typing `/`
- ✅ No references to non-existent skills in docs
- ✅ `brain-init` creates distributed lesson structure
- ✅ `build_brain_db.py` extracts domain from paths
- ✅ Lessons frontmatter uses `status` (not `escalated`)

---

**Next:** Execute Phase 5.1 (remove non-existent skill references)
