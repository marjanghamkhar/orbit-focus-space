import { clampDuration, createIdleTimer, MAX_GOAL, MIN_GOAL } from '../lib/storage';
import { FREE_FOCUS_KEY, type FocusSession, type FocusTimer, type OrbitState, type Task } from '../lib/types';

export type Action =
  | { type: 'addTask'; task: Task }
  | { type: 'restoreTask'; task: Task; index: number; timer: FocusTimer | null; now: number }
  | { type: 'toggleTask'; id: string; now: number }
  | { type: 'deleteTask'; id: string }
  | { type: 'setGoal'; goal: number }
  /** Open a task's (or free focus) timer in Focus Mode. Pauses any other running timer. */
  | { type: 'selectTimer'; key: string; now: number }
  /** Change the active timer's duration. Only while idle or completed. */
  | { type: 'setDuration'; minutes: number }
  /** Discard the active timer's paused progress and start fresh with a new duration. */
  | { type: 'restartWithDuration'; minutes: number; now: number }
  | { type: 'startTimer'; now: number }
  | { type: 'pauseTimer'; now: number }
  | { type: 'resumeTimer'; now: number }
  | { type: 'resetTimer' }
  | { type: 'completeTimer'; now: number }
  | { type: 'dismissCompletion' }
  | { type: 'setGuideHidden'; hidden: boolean }
  | { type: 'hydrate'; state: OrbitState };

export function getTimer(state: OrbitState, key: string): FocusTimer {
  return state.timers[key] ?? createIdleTimer();
}

const keyExists = (state: OrbitState, key: string) =>
  key === FREE_FOCUS_KEY || state.tasks.some((t) => t.id === key);

const withTimer = (state: OrbitState, key: string, timer: FocusTimer): OrbitState => ({
  ...state,
  timers: { ...state.timers, [key]: timer },
});

/** Records a finished countdown exactly once (the session id is derived from the timer's start). */
function completeTimer(state: OrbitState, key: string): OrbitState {
  const timer = state.timers[key];
  if (!timer || timer.status !== 'running' || timer.endsAt === null || timer.startedAt === null) return state;
  const id = `session-${key}-${timer.startedAt}`;
  const task = key === FREE_FOCUS_KEY ? null : state.tasks.find((t) => t.id === key) ?? null;
  const session: FocusSession = {
    id,
    taskId: task?.id ?? null,
    taskTitle: task?.title ?? null,
    minutes: timer.duration,
    startedAt: timer.startedAt,
    completedAt: timer.endsAt,
  };
  const alreadyRecorded = state.sessions.some((s) => s.id === id);
  return {
    ...withTimer(state, key, { ...timer, status: 'completed', endsAt: null, remainingMs: 0, lastSessionId: id }),
    sessions: alreadyRecorded ? state.sessions : [...state.sessions, session],
  };
}

/** Pauses a running timer, or completes it if its time is already up. */
function pauseOrComplete(state: OrbitState, key: string, now: number): OrbitState {
  const timer = state.timers[key];
  if (!timer || timer.status !== 'running' || timer.endsAt === null) return state;
  const remainingMs = timer.endsAt - now;
  if (remainingMs <= 0) return completeTimer(state, key);
  return withTimer(state, key, { ...timer, status: 'paused', endsAt: null, remainingMs });
}

/** Enforces "only one timer runs": pauses every running timer except `exceptKey`. */
function pauseOthers(state: OrbitState, exceptKey: string, now: number): OrbitState {
  let next = state;
  for (const key of Object.keys(state.timers)) {
    if (key !== exceptKey && state.timers[key].status === 'running') next = pauseOrComplete(next, key, now);
  }
  return next;
}

/** A finished countdown resets to a fresh idle timer (same duration) once the user moves on. */
function clearCompleted(state: OrbitState, key: string): OrbitState {
  const timer = state.timers[key];
  return timer?.status === 'completed' ? withTimer(state, key, createIdleTimer(timer.duration)) : state;
}

function startFresh(timer: FocusTimer, minutes: number, now: number): FocusTimer {
  const duration = clampDuration(minutes);
  return {
    duration,
    status: 'running',
    startedAt: now,
    endsAt: now + duration * 60_000,
    remainingMs: duration * 60_000,
    lastSessionId: timer.lastSessionId,
  };
}

export function reducer(state: OrbitState, action: Action): OrbitState {
  const key = state.activeKey;
  const active = getTimer(state, key);

  switch (action.type) {
    case 'addTask':
      return { ...state, tasks: [...state.tasks, action.task] };

    case 'restoreTask': {
      if (state.tasks.some((t) => t.id === action.task.id)) return state;
      const tasks = [...state.tasks];
      tasks.splice(Math.min(action.index, tasks.length), 0, action.task);
      let next: OrbitState = { ...state, tasks };
      const t = action.timer;
      if (t && t.status !== 'idle') {
        // A timer deleted while running comes back paused, with the time that was left.
        if (t.status === 'running' && t.endsAt !== null) {
          const remainingMs = t.endsAt - action.now;
          if (remainingMs > 0) next = withTimer(next, action.task.id, { ...t, status: 'paused', endsAt: null, remainingMs });
        } else {
          next = withTimer(next, action.task.id, t);
        }
      }
      return next;
    }

    case 'toggleTask': {
      const target = state.tasks.find((t) => t.id === action.id);
      if (!target) return state;
      const completing = !target.completed;
      const tasks = state.tasks.map((t) =>
        t.id === action.id ? { ...t, completed: completing, completedAt: completing ? action.now : null } : t,
      );
      let next: OrbitState = { ...state, tasks };
      // Finishing a task mid-session pauses its timer (progress is kept if it's reopened).
      if (completing) next = pauseOrComplete(next, action.id, action.now);
      return next;
    }

    case 'deleteTask': {
      // A deleted task's unfinished session is discarded: no focus time is recorded for it.
      const tasks = state.tasks.filter((t) => t.id !== action.id);
      const timers = { ...state.timers };
      delete timers[action.id];
      return { ...state, tasks, timers, activeKey: state.activeKey === action.id ? FREE_FOCUS_KEY : state.activeKey };
    }

    case 'setGoal': {
      const goal = Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.round(action.goal)));
      return goal === state.dailyGoal ? state : { ...state, dailyGoal: goal };
    }

    case 'selectTimer': {
      if (!keyExists(state, action.key)) return state;
      if (action.key === key) return state;
      // Switching never moves time between timers: the previous one keeps its own remaining time.
      let next = pauseOthers(state, action.key, action.now);
      next = clearCompleted(next, key);
      next = clearCompleted(next, action.key);
      return { ...next, activeKey: action.key };
    }

    case 'setDuration':
      if (active.status !== 'idle' && active.status !== 'completed') return state;
      if (active.status === 'idle' && active.duration === clampDuration(action.minutes)) return state;
      return withTimer(state, key, createIdleTimer(action.minutes));

    case 'restartWithDuration':
      // Explicit, user-confirmed restart of a paused timer. The discarded progress is never recorded.
      if (active.status !== 'paused') return state;
      return withTimer(pauseOthers(state, key, action.now), key, startFresh(active, action.minutes, action.now));

    case 'startTimer':
      if (active.status !== 'idle') return state;
      return withTimer(pauseOthers(state, key, action.now), key, startFresh(active, active.duration, action.now));

    case 'pauseTimer':
      return pauseOrComplete(state, key, action.now);

    case 'resumeTimer':
      if (active.status !== 'paused') return state;
      return withTimer(pauseOthers(state, key, action.now), key, {
        ...active,
        status: 'running',
        endsAt: action.now + active.remainingMs,
      });

    case 'resetTimer':
      // A reset session is discarded: no focus time is ever recorded for it.
      if (active.status === 'idle') return state;
      return withTimer(state, key, createIdleTimer(active.duration));

    case 'completeTimer': {
      // Only a countdown that genuinely ran to zero is recorded.
      const runningKey = Object.keys(state.timers).find((k) => state.timers[k].status === 'running');
      if (!runningKey) return state;
      const endsAt = state.timers[runningKey].endsAt;
      if (endsAt === null || action.now < endsAt) return state;
      return completeTimer(state, runningKey);
    }

    case 'dismissCompletion':
      return clearCompleted(state, key);

    case 'setGuideHidden':
      // Purely presentational: never touches tasks, sessions or timers.
      return state.guideDismissed === action.hidden ? state : { ...state, guideDismissed: action.hidden };

    case 'hydrate':
      return action.state;
  }
}
