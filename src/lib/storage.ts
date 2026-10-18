import {
  DEFAULT_DURATION,
  FREE_FOCUS_KEY,
  MAX_DURATION,
  MIN_DURATION,
  PRIORITIES,
  type FocusSession,
  type FocusTimer,
  type OrbitState,
  type Task,
} from './types';
import { dayKey } from './activity';

export const STORAGE_KEY = 'orbit:v1';

export const DEFAULT_GOAL = 3;
export const MIN_GOAL = 1;
export const MAX_GOAL = 20;

export function clampDuration(minutes: number): number {
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(minutes)));
}

export function createIdleTimer(duration: number = DEFAULT_DURATION): FocusTimer {
  const d = clampDuration(duration);
  return { duration: d, status: 'idle', startedAt: null, endsAt: null, remainingMs: d * 60_000, lastSessionId: null };
}

export function createInitialState(): OrbitState {
  return {
    tasks: [],
    dailyGoal: DEFAULT_GOAL,
    goalAchievements: {},
    sessions: [],
    timers: {},
    activeKey: FREE_FOCUS_KEY,
    guideDismissed: false,
  };
}

// --- Defensive parsing: never trust what is in localStorage. ---

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

function parseTask(v: unknown): Task | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const title = str(v.title);
  const createdAt = num(v.createdAt);
  if (!id || !title || createdAt === null) return null;
  const priority = PRIORITIES.includes(v.priority as Task['priority']) ? (v.priority as Task['priority']) : 'medium';
  const completed = v.completed === true;
  return {
    id,
    title,
    priority,
    completed,
    createdAt,
    completedAt: completed ? num(v.completedAt) ?? createdAt : null,
  };
}

function parseSession(v: unknown): FocusSession | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const minutes = num(v.minutes);
  const startedAt = num(v.startedAt);
  const completedAt = num(v.completedAt);
  if (!id || minutes === null || minutes <= 0 || startedAt === null || completedAt === null) return null;
  return { id, taskId: str(v.taskId), taskTitle: str(v.taskTitle), minutes, startedAt, completedAt };
}

/** Parses one timer. Note: never recomputes time from Date.now(), so parsing is deterministic. */
function parseTimer(v: unknown): FocusTimer | null {
  if (!isObj(v)) return null;
  const durationRaw = num(v.duration);
  const idle = createIdleTimer(durationRaw ?? DEFAULT_DURATION);
  const fullMs = idle.duration * 60_000;
  const startedAt = num(v.startedAt);
  const lastSessionId = str(v.lastSessionId);

  if (v.status === 'running') {
    const endsAt = num(v.endsAt);
    if (endsAt === null || startedAt === null) return idle;
    return { ...idle, status: 'running', startedAt, endsAt, remainingMs: fullMs };
  }
  if (v.status === 'paused') {
    const remainingMs = num(v.remainingMs);
    if (remainingMs === null || startedAt === null) return idle;
    return { ...idle, status: 'paused', startedAt, remainingMs: Math.min(fullMs, Math.max(0, remainingMs)) };
  }
  if (v.status === 'completed') {
    return { ...idle, status: 'completed', startedAt, remainingMs: 0, lastSessionId };
  }
  return idle;
}

export function parseState(raw: unknown): OrbitState {
  const initial = createInitialState();
  if (!isObj(raw)) return initial;
  const tasks = Array.isArray(raw.tasks) ? raw.tasks.map(parseTask).filter((t): t is Task => t !== null) : [];
  const taskIds = new Set(tasks.map((t) => t.id));
  const validKey = (k: string) => k === FREE_FOCUS_KEY || taskIds.has(k);
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.map(parseSession).filter((s): s is FocusSession => s !== null)
    : [];
  const goal = num(raw.dailyGoal);
  const dailyGoal = goal === null ? DEFAULT_GOAL : Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(goal)));
  const goalAchievements: Record<string, number> = {};
  if (isObj(raw.goalAchievements)) {
    for (const [day, level] of Object.entries(raw.goalAchievements)) {
      const n = num(level);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && n !== null && Number.isInteger(n) && n >= MIN_GOAL && n <= MAX_GOAL) {
        goalAchievements[day] = n;
      }
    }
  } else {
    // Backfill only when existing completed task timestamps give evidence of a reached goal.
    // Older goal changes cannot be reconstructed; the saved current goal is the best available estimate.
    const completedByDay = new Map<string, number>();
    for (const task of tasks) {
      if (!task.completed || task.completedAt === null) continue;
      const day = dayKey(task.completedAt);
      completedByDay.set(day, (completedByDay.get(day) ?? 0) + 1);
    }
    for (const [day, count] of completedByDay) {
      if (count >= dailyGoal) goalAchievements[day] = dailyGoal;
    }
  }

  const timers: Record<string, FocusTimer> = {};
  let activeKey = FREE_FOCUS_KEY;
  const sessionIds = new Set(sessions.map((s) => s.id));
  // "Completed" is only real if the session it recorded exists; anything else is reset, never celebrated.
  const verified = (t: FocusTimer | null): FocusTimer | null =>
    t && t.status === 'completed' && (!t.lastSessionId || !sessionIds.has(t.lastSessionId)) ? createIdleTimer(t.duration) : t;

  if (isObj(raw.timers)) {
    for (const [key, value] of Object.entries(raw.timers)) {
      const timer = verified(parseTimer(value));
      if (timer && validKey(key)) timers[key] = timer;
    }
    const k = str(raw.activeKey);
    if (k && validKey(k)) activeKey = k;
  } else if (isObj(raw.timer)) {
    // Migrate the earlier single shared timer into the per-task model.
    const legacyTaskId = str(raw.timer.taskId);
    const key = legacyTaskId && taskIds.has(legacyTaskId) ? legacyTaskId : FREE_FOCUS_KEY;
    const timer = verified(parseTimer(raw.timer));
    if (timer && timer.status !== 'idle') timers[key] = timer;
    activeKey = key;
  }

  // Invariant: at most one timer runs. Keep the active one if it runs, otherwise the first found.
  const running = Object.keys(timers).filter((k) => timers[k].status === 'running');
  const keep = running.includes(activeKey) ? activeKey : running[0];
  for (const k of running) {
    if (k !== keep) {
      const t = timers[k];
      // Only reachable with corrupted data, so reading the clock here can't cause cross-tab write loops.
      const remainingMs = Math.min(t.duration * 60_000, Math.max(0, (t.endsAt ?? 0) - Date.now()));
      timers[k] = { ...t, status: 'paused', endsAt: null, remainingMs };
    }
  }

  return {
    tasks,
    sessions,
    dailyGoal,
    goalAchievements,
    timers,
    activeKey,
    guideDismissed: raw.guideDismissed === true,
  };
}

export function loadState(): OrbitState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parseState(JSON.parse(raw)) : createInitialState();
  } catch {
    return createInitialState();
  }
}

export function saveState(state: OrbitState): void {
  try {
    const json = JSON.stringify(state);
    // Skipping identical writes avoids ping-ponging storage events between tabs.
    if (localStorage.getItem(STORAGE_KEY) !== json) localStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Storage can be full or blocked (private mode); the app keeps working in memory.
  }
}
