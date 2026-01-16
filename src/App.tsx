import './index.css';
import { useEffect } from 'react';
import { useStore } from '@/store';
import { DevAssistant, connectAssist } from '@/devtools';

function App() {
  const { theme, setTheme, user, setUser } = useStore();

  useEffect(() => {
    // Connect to assist server in dev mode
    if (import.meta.env.DEV && import.meta.env.VITE_ASSIST === '1') {
      connectAssist();
    }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Vibe Template
        </h1>
        <p className="text-zinc-400 mt-2">
          AI-introspectable React scaffold with dev observability
        </p>
      </header>

      <main className="space-y-6">
        <section className="p-6 bg-zinc-900 rounded-lg border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4">State Demo</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-zinc-400">Theme:</span>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="px-3 py-1 bg-zinc-800 rounded hover:bg-zinc-700 transition"
              >
                {theme}
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-zinc-400">User:</span>
              {user ? (
                <span className="text-green-400">{user.name}</span>
              ) : (
                <button
                  onClick={() => setUser({ id: '1', name: 'Demo User' })}
                  className="px-3 py-1 bg-zinc-800 rounded hover:bg-zinc-700 transition"
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="p-6 bg-zinc-900 rounded-lg border border-zinc-800">
          <h2 className="text-xl font-semibold mb-4">Console Demo</h2>
          <div className="flex gap-2">
            <button
              onClick={() => console.log('Hello from app!')}
              className="px-3 py-1 bg-blue-700 rounded hover:bg-blue-600 transition"
            >
              Log
            </button>
            <button
              onClick={() => console.warn('Warning message')}
              className="px-3 py-1 bg-yellow-700 rounded hover:bg-yellow-600 transition"
            >
              Warn
            </button>
            <button
              onClick={() => console.error('Error message')}
              className="px-3 py-1 bg-red-700 rounded hover:bg-red-600 transition"
            >
              Error
            </button>
            <button
              onClick={() => fetch('/api/test').catch(() => { })}
              className="px-3 py-1 bg-purple-700 rounded hover:bg-purple-600 transition"
            >
              Fetch
            </button>
          </div>
        </section>
      </main>

      {/* Dev Assistant - only in dev mode with VITE_ASSIST=1 */}
      {import.meta.env.DEV && import.meta.env.VITE_ASSIST === '1' && <DevAssistant />}
    </div>
  );
}

export default App;
