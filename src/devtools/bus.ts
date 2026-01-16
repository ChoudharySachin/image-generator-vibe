// Debug event bus - captures logs, errors, network, state changes
export type EventType = 'log' | 'error' | 'network' | 'state' | 'navigation' | 'command';

export interface BusEvent {
  id: string;
  type: EventType;
  timestamp: number;
  data: unknown;
}

type Listener = (event: BusEvent) => void;

class DebugBus {
  private listeners: Set<Listener> = new Set();
  private buffer: BusEvent[] = [];
  private maxBuffer = 500;

  emit(type: EventType, data: unknown) {
    const event: BusEvent = {
      id: crypto.randomUUID(),
      type,
      timestamp: Date.now(),
      data,
    };
    
    this.buffer.push(event);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.shift();
    }
    
    this.listeners.forEach(listener => listener(event));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getBuffer(): BusEvent[] {
    return [...this.buffer];
  }

  getContext() {
    const logs = this.buffer.filter(e => e.type === 'log' || e.type === 'error').slice(-50);
    const lastError = this.buffer.filter(e => e.type === 'error').pop();
    const lastState = this.buffer.filter(e => e.type === 'state').pop();
    const recentNetwork = this.buffer.filter(e => e.type === 'network').slice(-20);

    return {
      logs,
      lastError,
      lastState,
      recentNetwork,
      timestamp: Date.now(),
    };
  }

  clear() {
    this.buffer = [];
  }
}

export const bus = new DebugBus();

// Monkey-patch console
if (import.meta.env.DEV) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;

  console.log = (...args) => {
    bus.emit('log', { level: 'log', args: args.map(String) });
    originalLog.apply(console, args);
  };

  console.warn = (...args) => {
    bus.emit('log', { level: 'warn', args: args.map(String) });
    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    bus.emit('error', { level: 'error', args: args.map(String) });
    originalError.apply(console, args);
  };

  console.info = (...args) => {
    bus.emit('log', { level: 'info', args: args.map(String) });
    originalInfo.apply(console, args);
  };

  // Capture uncaught errors
  window.addEventListener('error', (e) => {
    bus.emit('error', {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
      stack: e.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (e) => {
    bus.emit('error', {
      type: 'unhandledrejection',
      reason: String(e.reason),
      stack: e.reason?.stack,
    });
  });

  // Wrap fetch
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const start = Date.now();
    const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : (args[0] as Request).url;
    const method = (args[1]?.method || 'GET').toUpperCase();

    try {
      const response = await originalFetch.apply(window, args);
      bus.emit('network', {
        url,
        method,
        status: response.status,
        duration: Date.now() - start,
        ok: response.ok,
      });
      return response;
    } catch (error) {
      bus.emit('network', {
        url,
        method,
        error: String(error),
        duration: Date.now() - start,
        ok: false,
      });
      throw error;
    }
  };
}
