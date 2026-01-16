---
name: debug
description: Debugging protocol for systematic bug investigation and resolution.
allowed-tools:
  - bash
  - read
  - grep
  - finder
metadata:
  version: "1.0"
---

# Debug Protocol

EXECUTE steps sequentially. DO NOT skip.

## Step 1: Context Gathering

1. READ `@TEMPLATE_ARCHITECTURE.md` for project structure
2. CHECK recent commits for context on recent changes
3. DETERMINE if app is running with WebSocket interface available
   - IF YES: stream logs + ask user to reproduce issue
   - IF NO: consider using `@.agent/skills/browser-tools/` skill

## Step 2: User Inquiry

EXTRACT from user (accept partial answers):
- Reproduction steps
- Screenshots/logs
- When/where issue occurs
- Error messages

PREFER WebSocket log streaming over browser automation when app is running.

## Step 3: Diagnosis

1. FORM hypothesis based on gathered info
2. USE subagents to scan codebase; they MUST report `file:lineNo` + summary
3. ADD temporary logs to verify hypothesis
4. IF architecture blocks introspection → refactor to align with `@TEMPLATE_ARCHITECTURE.md`

## Step 4: Resolution

1. VERIFY fix works
2. COMMIT changes (semantic commit)
3. REMOVE debug logs (keep only high-value permanent logs in error-prone code)

## Step 5: Escalation (if stuck)

1. COMPILE: original issue, analysis, trials, findings, surrounding code
2. WRITE to `.agent/plans/issue-report.md`
3. ASK user to paste file into ChatGPT web with extended thinking enabled
