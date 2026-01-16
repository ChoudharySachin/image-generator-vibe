---
name: plan
description: Feature planning protocol for breaking down tasks and creating PRDs.
allowed-tools:
  - bash
  - read
  - create_file
metadata:
  version: "1.0"
---

# Planning Protocol

EXECUTE steps sequentially. DO NOT skip.

## Case 1: New Project / Fresh Start

1. READ `@TEMPLATE_ARCHITECTURE.md`
2. PLAN for GitHub Pages compatible deployment
3. IF backend needed → install pocketbase via `@.agent/skills/tools/SKILL.md`
4. DECOMPOSE request into subtasks
5. PROCEED to Case 2

## Case 2: New Feature

### Research Phase

1. READ existing files related to feature
2. DOCUMENT sources/citations as you go
3. IF complex UI component → document current functionality in `.agent/plans/feature/<name>.md` (prevents regression)

### Q&A Phase

1. CREATE `.agent/plans/<name>.md` with questions
   - Use non-technical language
   - Format as a/b/c options
   - Include d) "use recommended" option (you choose per TEMPLATE_ARCHITECTURE.md)
2. OPEN file for user to edit
3. READ answers, APPEND more questions until no confusion remains

### Output

WRITE `.agent/plans/<name>.prd` and ask user to give to implementer agent in new tab.

---

## Example Breakdowns

### Example 1: AI Image Generation App (OpenRouter)

1. READ TEMPLATE_ARCHITECTURE.md
2. SPLIT into:
   - `core/` logic decoupled from UI, testable via CLI
   - Identify core/ vs UI boundaries (minimal abstraction, defensive decoupling)
   - UI after core verified: Actors, state, brain-dead render-only UI
   - Architecture scaffolding: WebSocket system for logs/state/errors

### Example 2: Data Transform Website (CSV/JSON)

1. READ TEMPLATE_ARCHITECTURE.md
2. SPLIT into:
   - `core/` with CLI that transforms sample data; verify with user
   - Separates UI bugs from processing bugs
   - UI connects to core with usual architecture scaffolding
