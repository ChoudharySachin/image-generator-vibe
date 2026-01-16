---
name: browser-tools
description: Chrome DevTools Protocol tools for agent-assisted web automation.
allowed-tools:
  - bash
metadata:
  version: "1.0"
---

# Browser Tools

Chrome DevTools Protocol tools connecting to Chrome on `:9222` with remote debugging.

## Installation

ASSUME installed. Run only if commands fail:

```bash
npm install
```

IF npm/node missing → read `@.agent/skills/tools/SKILL.md`

## Invocation Format

CORRECT:

The scripts use shebangs to invoke the correct node version.

```bash
./browser-start.js
./browser-nav.js https://example.com
./browser-pick.js "Click the button"
```

INCORRECT (do not use):

```bash
node browser-start.js      # No 'node' prefix
```

## Commands

### Start Chrome

```bash
browser-start.js              # Fresh profile
browser-start.js --profile    # Copy user profile (cookies, logins)
```

### Navigate

```bash
browser-nav.js https://example.com        # Current tab
browser-nav.js https://example.com --new  # New tab
```

### Console Logs

```bash
browser-console.js
```

Returns all logs since last `browser-nav.js` (console + browser errors). No reload needed.

### Evaluate JavaScript

```bash
browser-eval.js 'document.title'
browser-eval.js 'document.querySelectorAll("a").length'
```

Executes in async context.

### Screenshot

```bash
browser-screenshot.js
```

Returns temp file path of current viewport.

### Pick Elements

```bash
browser-pick.js "Click the submit button"
```

INTERACTIVE: User clicks elements (Cmd/Ctrl+Click for multi-select), presses Enter. Returns CSS selectors.

Use when:

- User says "I want to click that button"
- User says "extract data from these items"
- Page structure is complex/ambiguous

### Cookies

```bash
browser-cookies.js
```

Displays all cookies with domain, path, httpOnly, secure flags.

### Extract Content

```bash
browser-content.js https://example.com
```

Navigates and extracts readable content as markdown (uses Mozilla Readability + Turndown).
