import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, command, type BackendState } from '../services/api';
import { defaultPreferences, emptySnapshot, type Preferences, type Snapshot } from '../types';
import { toDay } from '../utils/dates';
import { taskRows } from '../services/calculations';
interface AppContextType {
  data: Snapshot;
  prefs: Preferences;
  reports: BackendState['reports'];
  streaks: BackendState['streaks'];
  today: string;
  loading: boolean;
  error: string;
  toast: (message: string, error?: boolean) => void;
  run: (action: () => Promise<unknown>, message?: string) => Promise<boolean>;
}
const Context = createContext<AppContextType | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState(''),
    [message, setMessage] = useState<{ text: string; error: boolean } | null>(null),
    [today, setToday] = useState(toDay());
  const [backend, setBackend] = useState<BackendState | null>(null);
  useEffect(() => {
    let active = true,
      sequence = 0;
    const refresh = async () => {
      const request = ++sequence;
      try {
        const next = await api<BackendState>('/api/state');
        if (active && request === sequence) {
          setBackend((previous) =>
            JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
          );
          setError('');
        }
      } catch (failure) {
        if (active && request === sequence)
          setError(failure instanceof Error ? failure.message : 'Start the Python backend.');
      }
    };
    void refresh();
    const changed = () => {
      void refresh();
    };
    window.addEventListener('dayframe-saved', changed);
    const timer = setInterval(changed, 3000);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('dayframe-saved', changed);
    };
  }, []);
  const snapshot = backend?.data;
  const data = snapshot ?? emptySnapshot,
    prefs = data.preferences[0] ?? defaultPreferences;
  const toast = useCallback((text: string, error = false) => setMessage({ text, error }), []);
  const run = useCallback(
    async (action: () => Promise<unknown>, message?: string) => {
      try {
        await action();
        if (message) toast(message);
        return true;
      } catch (e) {
        toast(
          e instanceof Error ? e.message : 'That change could not be saved. Please try again.',
          true,
        );
        return false;
      }
    },
    [toast],
  );
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    const timer = setInterval(() => setToday(toDay()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        prefs.theme === 'system' ? (media.matches ? 'dark' : 'light') : prefs.theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [prefs.theme]);
  useEffect(() => {
    if (
      !prefs.notifications ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    )
      return;
    const check = async () => {
      const current = new Date();
      const date = toDay(current);
      const time = current.toTimeString().slice(0, 5);
      const rows = taskRows(data, date).filter(
        (r) => !r.done && r.task.dueTime && r.task.dueTime <= time,
      );
      for (const r of rows) {
        const key = `${r.task.id}:${date}:${r.task.dueTime}`;
        try {
          const claimed = await command<boolean>('reminder.claim', { id: key });
          if (claimed) {
            try {
              new Notification('DAYFRAME · A little reminder', { body: r.task.title, tag: key });
            } catch {
              await command('reminder.release', { id: key });
            }
          }
        } catch {
          /* A competing tab may have claimed this reminder. */
        }
      }
    };
    void check();
    const timer = setInterval(() => {
      void check();
    }, 30000);
    return () => clearInterval(timer);
  }, [data, prefs.notifications]);
  return (
    <Context.Provider
      value={{
        data,
        prefs,
        reports: backend?.reports ?? {},
        streaks: backend?.streaks ?? {},
        today,
        loading: !snapshot,
        error,
        toast,
        run,
      }}
    >
      {children}
      {message && (
        <div
          className={`toast ${message.error ? 'toast-error' : ''}`}
          role={message.error ? 'alert' : 'status'}
        >
          {message.text}
          <button aria-label="Dismiss message" onClick={() => setMessage(null)}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error('AppProvider is missing');
  return value;
}
