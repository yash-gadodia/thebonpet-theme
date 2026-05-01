---
name: clarify
description: One round of clarification before planning ambiguous changes. Short list of numbered questions, not an interrogation.
---

## When to use
- The user request names an outcome without a mechanism ("make the popup work better").
- A copy change could span 1 or 10 files, and only the user knows how wide.
- Mobile vs desktop behaviour is unspecified for a layout change.
- A new section is proposed but it's unclear where it belongs in `templates/index.json`.

## What to ask
Max 3 questions, numbered. Offer a best-guess default next to each so the user can skim and accept.

## Format
```
Before I start, quick checks:
1. <question> — default guess: <answer>
2. <question> — default guess: <answer>
3. <question> — default guess: <answer>

Reply with just the numbers that differ from the defaults, or "go".
```

## What NOT to ask
- Anything readable from `ARCHITECTURE.md`, `../CLAUDE.md`, existing files.
- "What should the button say?" when the user already said so.
- Permission questions ("should I proceed?"). Just offer defaults.
- More than one round. If the defaults aren't enough, you're over-planning.
