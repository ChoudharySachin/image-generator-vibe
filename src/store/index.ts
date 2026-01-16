// Zustand store with dev bus integration
import { create } from 'zustand';
import { bus } from '@/devtools/bus';
import { commands } from '@/devtools/commands';

// Generic app state - extend this for your app
export interface AppState {
  // Example state fields
  user: { id: string; name: string } | null;
  theme: 'light' | 'dark';
  
  // Actions
  setUser: (user: AppState['user']) => void;
  setTheme: (theme: AppState['theme']) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  theme: 'dark' as const,
};

export const useStore = create<AppState>((set) => ({
  ...initialState,
  
  setUser: (user) => set({ user }),
  setTheme: (theme) => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    set({ theme });
  },
  reset: () => set(initialState),
}));

// Subscribe to state changes and emit to bus (dev only)
if (import.meta.env.DEV) {
  let lastEmit = 0;
  const throttleMs = 100;

  useStore.subscribe((state) => {
    const now = Date.now();
    if (now - lastEmit > throttleMs) {
      lastEmit = now;
      // Strip functions from state for serialization
      const serializable = Object.fromEntries(
        Object.entries(state).filter(([, v]) => typeof v !== 'function')
      );
      bus.emit('state', serializable);
    }
  });

  // Register store commands
  commands.register('resetState', 'Reset app state to initial values', () => {
    useStore.getState().reset();
  });

  commands.register('setState', 'Set partial state', (payload) => {
    useStore.setState(payload as Partial<AppState>);
  });

  commands.register('getState', 'Get current state snapshot', () => {
    const state = useStore.getState();
    const serializable = Object.fromEntries(
      Object.entries(state).filter(([, v]) => typeof v !== 'function')
    );
    console.log('[State Snapshot]', serializable);
  });
}
