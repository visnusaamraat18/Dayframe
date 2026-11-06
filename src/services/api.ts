import type { Snapshot } from '../types';
import type { analytics, habitStats } from './calculations';
export interface BackendState {
  data: Snapshot;
  reports: Record<number, ReturnType<typeof analytics>>;
  streaks: Record<string, ReturnType<typeof habitStats>>;
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      'The Python backend is unavailable. Start python serve_dayframe.py and try again.',
    );
  }
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error('DAYFRAME needs its Python backend. Run python serve_dayframe.py.');
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || 'The Python backend could not save this change.');
  return result as T;
}
export async function command<T = void>(action: string, args: object = {}): Promise<T> {
  const response = await api<{ result: T }>('/api/command', { action, args });
  if (!action.startsWith('reminder.')) window.dispatchEvent(new Event('dayframe-saved'));
  return response.result;
}
