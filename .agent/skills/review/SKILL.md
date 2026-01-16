---
name: review
description: Code review protocol for evaluating changes against architecture guidelines.
allowed-tools:
  - bash
  - read
  - grep
metadata:
  version: "1.0"
---

# Review Protocol

## Scope

Review uncommitted changes OR last N commits.

## Evaluation Criteria

READ `@TEMPLATE_ARCHITECTURE.md` first.

### HARD REJECT if:

1. **Coupling violation**: UI contains logic. UI MUST be dumb - only listen and render state, zero logic.

2. **Introspectibility missing**: New code does not expose functions or maintain WebSocket compatibility when it could.

3. **Tests missing**: Core logic is testable but no tests present.

## Linting Checks

VERIFY linting/formatting passes.

### Remove AI Slop

Flag and request removal of:
- Non-DRY repetitive code that can be compressed idiomatically
- Extra comments a human wouldn't add (or inconsistent with file)
- Abnormal defensive checks/try-catch in trusted codepaths
- `any` casts to bypass type issues
- Style inconsistent with rest of file

## Finalize

IF uncommitted changes remain → add + semantic commit
