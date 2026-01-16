// Safe command registry for AI agents to control the app
import { bus } from './bus';

type CommandHandler = (payload?: unknown) => void | Promise<void>;

interface CommandDef {
  name: string;
  description: string;
  handler: CommandHandler;
}

class CommandRegistry {
  private commands: Map<string, CommandDef> = new Map();

  register(name: string, description: string, handler: CommandHandler) {
    this.commands.set(name, { name, description, handler });
  }

  async execute(name: string, payload?: unknown): Promise<{ success: boolean; error?: string }> {
    const cmd = this.commands.get(name);
    if (!cmd) {
      return { success: false, error: `Unknown command: ${name}` };
    }

    try {
      await cmd.handler(payload);
      bus.emit('command', { name, payload, success: true });
      return { success: true };
    } catch (e) {
      const error = String(e);
      bus.emit('command', { name, payload, success: false, error });
      return { success: false, error };
    }
  }

  list(): Array<{ name: string; description: string }> {
    return Array.from(this.commands.values()).map(({ name, description }) => ({
      name,
      description,
    }));
  }
}

export const commands = new CommandRegistry();

// Built-in commands
commands.register('navigate', 'Navigate to a route', (payload) => {
  const path = payload as string;
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
});

commands.register('reload', 'Reload the page', () => {
  window.location.reload();
});

commands.register('setTheme', 'Set theme to light/dark', (payload) => {
  const theme = payload as 'light' | 'dark';
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(theme);
});

commands.register('clearLogs', 'Clear the debug bus buffer', () => {
  bus.clear();
});
