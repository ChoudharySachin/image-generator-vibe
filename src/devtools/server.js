#!/usr/bin/env node
// WebSocket server for AI agent introspection
// Run with: node src/devtools/server.js

import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = process.env.ASSIST_PORT || 3001;

const httpServer = createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', clients: wss.clients.size }));
    return;
  }

  if (req.url === '/context') {
    // Return the latest context from connected clients
    res.writeHead(200);
    res.end(JSON.stringify(latestContext));
    return;
  }

  if (req.url === '/commands') {
    res.writeHead(200);
    res.end(JSON.stringify(commandsList));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

const wss = new WebSocketServer({ server: httpServer });

let latestContext = { logs: [], lastError: null, lastState: null, recentNetwork: [], timestamp: 0 };
let commandsList = [];

wss.on('connection', (ws) => {
  console.log('[assist] Client connected');

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'context') {
        latestContext = msg.data;
      } else if (msg.type === 'commands') {
        commandsList = msg.data;
      } else if (msg.type === 'event') {
        // Broadcast events to all other clients (for multi-agent scenarios)
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === 1) {
            client.send(JSON.stringify(msg));
          }
        });
      }
    } catch (e) {
      console.error('[assist] Parse error:', e);
    }
  });

  ws.on('close', () => {
    console.log('[assist] Client disconnected');
  });

  // Send any pending commands
  ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
});

// RPC endpoint for executing commands
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'execute') {
        // Broadcast command execution to the app client
        wss.clients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(JSON.stringify({
              type: 'execute',
              command: msg.command,
              payload: msg.payload,
              requestId: msg.requestId,
            }));
          }
        });
      }
    } catch (e) {
      // handled above
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[assist] Server running on http://localhost:${PORT}`);
  console.log(`[assist] WebSocket on ws://localhost:${PORT}`);
  console.log(`[assist] Endpoints:`);
  console.log(`  GET /health   - Server health`);
  console.log(`  GET /context  - Latest app context`);
  console.log(`  GET /commands - Available commands`);
});
