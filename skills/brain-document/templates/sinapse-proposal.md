# Sinapse Proposal Template

Use this template for each proposed sinapse update in `working-memory/sinapse-updates-{task_id}.md`.

---

## Proposal: {sinapse_path}

**Task:** {task_id}
**Date:** {date}
**Region:** {cortex_region}

### Proposed Changes

#### Additions

| Section | Content | Reason |
|---------|---------|--------|
| {section_name} | {proposed_text} | {why_needed} |

#### Updates

| Section | Was | Now | Reason |
|---------|-----|-----|--------|
| {section_name} | {old_text} | {new_text} | {why_changed} |

#### Removals

| Section | Content | Reason |
|---------|---------|--------|
| {section_name} | {removed_text} | {why_removed} |

### Impact Assessment

- **Confidence:** {high|medium|low} -- how certain is this change correct?
- **Scope:** {local|cross-domain} -- does it affect other regions?
- **Related Sinapses:** {list of [[sinapse]] links affected}

### Approval

- [ ] Developer approved this proposal

---

**Note:** Proposals stay in working-memory until `/brain-health` consolidation.
Brain-document NEVER writes directly to cortex sinapses.
