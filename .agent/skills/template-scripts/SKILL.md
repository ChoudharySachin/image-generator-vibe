---
name: template-scripts
description: Script templates for interacting with AI APIs and external services.
allowed-tools:
  - bash
  - read
  - create_file
metadata:
  version: "1.0"
---

# Script Templates

Reference templates for AI API integrations. ASK user for required credentials.

## Available Templates

### Text/Chat Generation

| Template | Credentials |
|----------|-------------|
| `openrouter-text-scripts.md` | `OPENROUTER_API_KEY` |

### Image Generation

| Template | Credentials |
|----------|-------------|
| `openrouter-image-scripts.md` | `OPENROUTER_API_KEY` |
| `geminiService.ts` | (style reference variant) |

### Video Generation

| Template | Credentials | Models |
|----------|-------------|--------|
| `kie-video-scripts.md` | `KIE_API_KEY` | veo3, veo3-fast, sora-2, kling-2.5 |
| `vertex-video-scripts.md` | `GOOGLE_APPLICATION_CREDENTIALS`, `VERTEX_PROJECT`, `VERTEX_LOCATION` | veo-3-fast, veo-3-quality, veo-2 |
