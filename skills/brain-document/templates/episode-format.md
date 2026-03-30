# Episode Format Template

Save episodes to `working-memory/episode-{task_id}-{type}.md`.

---

## Episode: {title}

**Type:** {anti-pattern|insight|correction|discovery}
**Date:** {date}
**Severity:** {critical|high|medium|low}

### Context

- **Task:** {task_id}
- **Files:** {list of files involved}
- **Region:** {cortex_region}

### Observation

{What happened -- factual description of the event, no opinions.}

### Learning

{What we learned -- the actionable knowledge extracted from this event.}

### Related

- **Sinapses:** {list of related [[sinapse]] links}
- **Episodes:** {list of related episode files, if any}

---

## Episode Types

| Type | When to Use | Example |
|------|-------------|---------|
| anti-pattern | A mistake was made and caught | Used mutable global state, caused race condition |
| insight | A non-obvious technique worked well | Batch inserts 10x faster than individual |
| correction | Existing documentation was wrong | Sinapse said "use X" but "Y" is correct |
| discovery | New pattern or capability found | Library supports streaming we didn't know about |

---

**File location:** `working-memory/episode-{task_id}-{type}.md`
Episodes are factual records. Brain-consolidate processes them into sinapse updates.
