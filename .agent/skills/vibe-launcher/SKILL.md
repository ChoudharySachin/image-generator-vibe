---
name: vibe-launcher
description: Build and configure the double-clickable macOS Launcher.app for dev servers.
allowed-tools:
  - bash
  - read
  - edit_file
metadata:
  version: "1.0"
---

# Vibe Launcher

Double-clickable macOS app that launches dev servers with web dashboard.

## Check/Install

```bash
which vibe-launcher
```

IF not found:
```bash
brew install pykancha/tap/vibe-launcher
```

IF brew missing → read `.agent/skills/tools/SKILL.md`

## Configuration

READ `.vibe.launcher.json`:

```json
{
  "entries": [
    {
      "name": "Display Name",
      "start": "command to start",
      "stop": "",
      "ports": [3000, 3001]
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `name` | Label shown in dashboard |
| `start` | Shell command (e.g., `pnpm dev`) |
| `stop` | Optional stop command (empty = SIGTERM) |
| `ports` | Ports to monitor for status |

## Build

```bash
vibe-launcher build
```

Creates `Launcher.app` in project root.

## Launcher.app Structure

```
Launcher.app/
  Contents/
    MacOS/launcher       # Shell script running vibe-launcher
    Resources/
      launch.html        # Dashboard UI (customizable)
      AGENTS.md          # API documentation
      openapi.json       # OpenAPI 3.0 spec
      AppIcon.icns       # App icon
    Info.plist           # macOS bundle metadata
```

Users can edit `launch.html` - changes apply on browser refresh.

## Launch

```bash
open Launcher.app                 # Open programmatically
open -R Launcher.app              # Reveal in Finder for manual launch
```

Dashboard at `http://localhost:9876` with start/stop/restart controls and logs.

## Workflow Summary

1. Check/install vibe-launcher
2. Read/modify `.vibe.launcher.json`
3. Run `vibe-launcher build`
4. Open `Launcher.app` or reveal in Finder for user
