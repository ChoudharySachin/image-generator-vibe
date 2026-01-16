// WebSocket client to sync with assist server
import { bus } from './bus';
import { commands } from './commands';

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;

export function connectAssist(port = 3001) {
  if (ws?.readyState === WebSocket.OPEN) return;

  try {
    ws = new WebSocket(`ws://localhost:${port}`);

    ws.onopen = () => {
      console.log('[assist] Connected to assist server');
      // Send initial context
      syncContext();
      syncCommands();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'execute') {
          // Execute command from remote
          commands.execute(msg.command, msg.payload).then((result) => {
            ws?.send(JSON.stringify({
              type: 'executeResult',
              requestId: msg.requestId,
              result,
            }));
          });
        }
      } catch (e) {
        console.error('[assist] Message parse error:', e);
      }
    };

    ws.onclose = () => {
      console.log('[assist] Disconnected, reconnecting in 5s...');
      ws = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(() => connectAssist(port), 5000);
    };

    ws.onerror = () => {
      ws?.close();
    };
  } catch {
    console.log('[assist] Could not connect to assist server');
  }
}

function syncContext() {
  if (ws?.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: 'context',
    data: bus.getContext(),
  }));
}

function syncCommands() {
  if (ws?.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: 'commands',
    data: commands.list(),
  }));
}

// Sync context on every event (throttled)
let syncTimer: number | null = null;
bus.subscribe(() => {
  if (syncTimer) return;
  syncTimer = window.setTimeout(() => {
    syncContext();
    syncTimer = null;
  }, 500);
});

// Also stream individual events
bus.subscribe((event) => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'event', data: event }));
  }
});
