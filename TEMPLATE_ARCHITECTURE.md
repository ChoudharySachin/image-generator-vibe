# Vibe Template - AI-Introspectable React Scaffold

A minimal React/Vite/shadcn template with built-in dev observability for AI agent integration.

## Architecture

```
src/
├── devtools/           # Dev-only observability layer
│   ├── bus.ts          # Event bus - captures console, errors, fetch, state
│   ├── commands.ts     # Safe command registry for AI control
│   ├── client.ts       # WebSocket client syncing to assist server
│   ├── overlay.tsx     # shadcn Sheet UI with Console/Network/State/Commands
│   ├── server.js       # Node WebSocket server for AI agents
│   └── index.ts        # Barrel export
├── store/
│   └── index.ts        # Zustand store with auto-publish to bus
├── components/ui/      # shadcn components
└── App.tsx             # Main app with conditional DevAssistant mount
```

## How It Works

1. **Debug Bus** (`bus.ts`) - Central event emitter that captures:

   - Console logs (monkey-patched `console.log/warn/error/info`)
   - Uncaught errors (`window.error`, `unhandledrejection`)
   - Network requests (wrapped `fetch`)
   - State changes (from Zustand subscription)

2. **Command Registry** (`commands.ts`) - Safe RPC surface for AI:

   - Built-in: `navigate`, `reload`, `setTheme`, `clearLogs`
   - Register custom commands per feature

3. **WebSocket Server** (`server.js`) - Endpoints for AI agents:

   - `GET /health` - Server status
   - `GET /context` - Latest logs, errors, state, network
   - `GET /commands` - Available commands
   - `WS ws://localhost:3001` - Live event stream + RPC

4. **Overlay UI** (`overlay.tsx`) - In-browser dev panel:
   - Console tab: Live log stream with level badges
   - Network tab: Fetch requests with status/timing
   - State tab: Current Zustand state snapshot
   - Commands tab: Execute registered commands

## Quick Start

```bash
# Clone template
cp -r vibe-template my-app
cd my-app

# Install
pnpm install

# Development with observability
pnpm dev:full   # Runs vite + assist server concurrently

# Or separately:
pnpm dev        # App at http://localhost:5173 (VITE_ASSIST=1)
pnpm assist     # API at http://localhost:3001
```

## Using the Template for a New App

### 1. Add Feature Store

```typescript
// src/features/my-feature/store.ts
import { create } from "zustand";
import { bus } from "@/devtools/bus";
import { commands } from "@/devtools/commands";

interface MyState {
  items: Item[];
  addItem: (item: Item) => void;
}

export const useMyStore = create<MyState>((set) => ({
  items: [],
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
}));

// Dev mode: emit state + register commands
if (import.meta.env.DEV) {
  useMyStore.subscribe((state) => {
    bus.emit("state", { module: "myFeature", ...state });
  });

  commands.register("addTestItem", "Add a test item", () => {
    useMyStore.getState().addItem({ id: "1", name: "Test" });
  });
}
```

### 2. Build UI Components

```tsx
// src/features/my-feature/MyComponent.tsx
import { useMyStore } from "./store";

export function MyComponent() {
  const { items, addItem } = useMyStore();
  // ... your UI
}
```

### 3. Mount in App

```tsx
// src/App.tsx
import { MyComponent } from "@/features/my-feature";
import { DevAssistant, connectAssist } from "@/devtools";

function App() {
  useEffect(() => {
    if (import.meta.env.DEV && import.meta.env.VITE_ASSIST === "1") {
      connectAssist();
    }
  }, []);

  return (
    <>
      <MyComponent />
      {import.meta.env.DEV && import.meta.env.VITE_ASSIST === "1" && (
        <DevAssistant />
      )}
    </>
  );
}
```

## AI Agent Integration

Query the assist server from your AI agent:

```bash
# Get current context
curl http://localhost:3001/context

# List available commands
curl http://localhost:3001/commands

# Execute command via WebSocket
wscat -c ws://localhost:3001
> {"type":"execute","command":"addTestItem","requestId":"abc123"}
```

## Production

The devtools are completely tree-shaken in production:

- Gated by `import.meta.env.DEV`
- `pnpm build` produces clean bundle without devtools code

## Scripts

| Command         | Description                       |
| --------------- | --------------------------------- |
| `pnpm dev`      | Start Vite with VITE_ASSIST=1     |
| `pnpm dev:solo` | Start Vite without assist overlay |
| `pnpm assist`   | Start WebSocket server only       |
| `pnpm dev:full` | Run both concurrently             |
| `pnpm build`    | Production build                  |
| `pnpm lint`     | ESLint check                      |
