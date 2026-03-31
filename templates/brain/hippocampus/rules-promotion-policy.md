---
id: hippocampus-rules-promotion-policy
title: Rules Promotion Policy
region: hippocampus
tags: [policy, rules, promotion, memory]
weight: 1.0
updated_at: {ISO8601_TIMESTAMP}
---

# Rules Promotion Policy

## Separation of Roles

- `.brain/` stores project memory, evolving knowledge, and working artifacts.
- `.claude/rules/` stores explicit repository rules that are stable enough to enforce during execution.
- Approved project memory belongs in `.brain/hippocampus/` and related `.brain/` directories.
- Promotion into `.claude/rules/` is optional, never automatic.

Never store project memory in the plugin installation directory.
Project memory must live in `.brain/` inside the repository.

## Promotion Flow

`episode -> insight -> proposal -> approved sinapse -> optional .claude/rules/`

1. Capture an `episode` in `.brain/episodes/` or another approved `.brain/` artifact.
2. Distill the episode into an `insight`.
3. Turn the insight into a reviewable `proposal`.
4. After approval, persist it as an approved `sinapse` or hippocampus update in `.brain/`.
5. Only when the rule is stable, durable, and prompt-critical, promote it into `.claude/rules/`.

## Promotion Rules

- Do not promote raw episodes directly into `.claude/rules/`.
- Do not skip approval.
- Keep project-specific memory in `.brain/`.
- Use `.claude/rules/` only for rules that must be stated explicitly on every execution path.
