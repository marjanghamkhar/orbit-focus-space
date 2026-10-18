import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { loadState, saveState, STORAGE_KEY } from '../lib/storage';
import { isSameDay } from '../lib/time';
import { FREE_FOCUS_KEY, type FocusTimer, type OrbitState } from '../lib/types';
import { getTimer, reducer, type Action } from './reducer';

export { getTimer };

export function getActiveTimer(state: OrbitState): FocusTimer {
  return getTimer(state, state.activeKey);
}

/** Display name for a timer key: the task's title, or null for free focus. */
export function titleForKey(state: OrbitState, key: string): string | null {
  if (key === FREE_FOCUS_KEY) return null;
  return state.tasks.find((t) => t.id === key)?.title ?? null;
}

export const isActiveStatus = (t: FocusTimer) => t.status === 'running' || t.status === 'paused';

interface OrbitContextValue {
  state: OrbitState;
  dispatch: Dispatch<Action>;
}

const OrbitContext = createContext<OrbitContextValue | null>(null);

export function OrbitProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  // Persist every change.
  useEffect(() => saveState(state), [state]);

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) dispatch({ type: 'hydrate', state: loadState() });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Finish the running countdown (at most one) based on wall-clock time, even if the tab was in the background.
  const runningKey = Object.keys(state.timers).find((k) => state.timers[k].status === 'running') ?? null;
  const endsAt = runningKey ? state.timers[runningKey].endsAt : null;
  useEffect(() => {
    if (runningKey === null) return;
    const check = () => dispatch({ type: 'completeTimer', now: Date.now() });
    check();
    const interval = window.setInterval(check, 500);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [runningKey, endsAt]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <OrbitContext.Provider value={value}>{children}</OrbitContext.Provider>;
}

export function useOrbit(): OrbitContextValue {
  const ctx = useContext(OrbitContext);
  if (!ctx) throw new Error('useOrbit must be used inside <OrbitProvider>');
  return ctx;
}

export interface TodayStats {
  tasksDone: number;
  sessions: number;
  focusMinutes: number;
}

export function selectTodayStats(state: OrbitState, now: number): TodayStats {
  const tasksDone = state.tasks.filter((t) => t.completed && t.completedAt !== null && isSameDay(t.completedAt, now)).length;
  const todaySessions = state.sessions.filter((s) => isSameDay(s.completedAt, now));
  return {
    tasksDone,
    sessions: todaySessions.length,
    focusMinutes: todaySessions.reduce((sum, s) => sum + s.minutes, 0),
  };
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

/** Active tasks first (by priority, then oldest), completed tasks after (most recent first). */
export function sortTasks<T extends OrbitState['tasks'][number]>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.completed && b.completed) return (b.completedAt ?? 0) - (a.completedAt ?? 0);
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return p !== 0 ? p : a.createdAt - b.createdAt;
  });
}
