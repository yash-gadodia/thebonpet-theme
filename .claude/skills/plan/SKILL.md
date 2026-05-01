---
name: plan
description: Bite-sized implementation plan for medium+ V3 theme changes. Outputs 2–5 min sub-tasks with exact file paths and Playwright coverage.
---

Use when a change touches more than one file OR introduces a new snippet/section/setting.

## Output shape
```
## Intent
<one sentence — what changes + why>

## Files
- [ ] <path> — <what changes>
- [ ] <path> — <what changes>

## Schema additions
- `config/settings_schema.json`: <field id>, <type>, <default>
- `config/settings_data.json`: <field id> = <value>

## Task breakdown (each 2–5 min)
1. <file:purpose> — exact edit scope
2. <file:purpose> — exact edit scope
3. tests/specs/<name>.spec.ts — <test intent>, @smoke yes/no

## Mobile + desktop
- <640px: <behaviour>
- 1024px+: <behaviour>

## Version bump
Current <X.Y.Z> → <X.Y+1.Z> (reason: <fix|feature>)

## Rollback
<one-liner: which files to revert OR re-publish prior theme>

## Devil's advocate
- What breaks if <assumption> is wrong?
- What's the detection signal if this regresses live?
```

## Rules
- No vague tasks ("improve the popup"). Every task names a file and a concrete edit.
- Every task is testable in isolation. If it isn't, split it.
- If a task can't be expressed in under ~5 min, it's still too big — decompose.
- For any change that touches user-visible behaviour, a Playwright spec with `@smoke` is required.
