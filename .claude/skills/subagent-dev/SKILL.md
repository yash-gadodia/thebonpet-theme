---
name: subagent-dev
description: For plans with 3+ independent tasks, dispatch fresh subagents per task, then two-stage review. Keeps main context clean for coordination.
---

## When to use
Any plan with ≥3 independent files to edit, OR any task that requires running verbose commands (Playwright, deploy polling, log parsing) that would bloat the main context.

## Rules
- **One subagent per independent task.** Don't batch unrelated edits into one agent.
- **Each subagent's prompt is self-contained.** Assume it can't see this conversation.
- **Dispatch in parallel** when tasks don't depend on each other (per CLAUDE.md global preference).
- **Main agent coordinates + reviews.** Don't duplicate subagent work.

## Prompt template for a "developer" subagent
```
Task: <one-line outcome>

Context: The Bon Pet V3 Shopify theme at /Users/yash/Documents/TheBonPet/shopify-theme-v3-remote.
Read /Users/yash/Documents/TheBonPet/shopify-theme-v3-remote/CLAUDE.md first.

Scope: <exact files to edit and what to change>

Constraints:
- No em-dashes. No new <form> elements. No {% include %} in <head>.
- Bump version marker in layout/theme.liquid line 2 if you edit rendered code.
- Route all popup opens through window.openBonPetForm().

Acceptance:
- <tests/specs/<name>.spec.ts> passes on both projects.
- Curl-level check: <grep pattern> returns <count>.

Report back:
- List of files touched.
- Test output (last 10 lines).
- Any blockers you hit.
```

## Review pass — two stages (per `review` skill)
1. Spec compliance: did the subagent do what the task said?
2. Code quality: run the project-rule greps.

## Anti-pattern
If you find yourself saying "based on your findings, implement the fix" to a subagent, you haven't understood the problem yet. Include the specific files and diffs in the prompt.
