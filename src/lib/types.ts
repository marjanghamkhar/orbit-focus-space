export type Priority = 'low' | 'medium' | 'high';

export const PRIORITIES: Priority[] = ['low', 'medium', 'high'];

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export interface Task {
  id: string;
  title: string;
  priority: Priority;
  completed: boolean;
  createdAt: number;
  completedAt: number | null;
}

export interface FocusSession {
  id: string;
  /** null for a free-focus session. */
  taskId: string | null;
  /** Snapshot of the task title, so history survives task deletion. */
  taskTitle: string | null;
  minutes: number;
  startedAt: number;
  completedAt: number;
}

export const DURATION_PRESETS = [15, 25, 45] as const;
export const DEFAULT_DURATION = 25;
export const MIN_DURATION = 1;
export const MAX_DURATION = 180;

/** Timer key used for focus sessions that aren't attached to a task. */
export const FREE_FOCUS_KEY = '__free__';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

/**
 * One independent countdown. Every task has its own (keyed by task id),
 * plus one for free focus (FREE_FOCUS_KEY). At most one timer runs at a time.
 */
export interface FocusTimer {
  /** Minutes. */
  duration: number;
  status: TimerStatus;
  startedAt: number | null;
  /** Wall-clock end time while running. Remaining time is always derived from it. */
  endsAt: number | null;
  /** Remaining time while idle or paused. */
  remainingMs: number;
  /** The session recorded when this countdown last completed. */
  lastSessionId: string | null;
}

export interface OrbitState {
  tasks: Task[];
  dailyGoal: number;
  sessions: FocusSession[];
  /** Per-task timers (task id → timer) plus the free-focus timer. Created on first use. */
  timers: Record<string, FocusTimer>;
  /** The timer shown in Focus Mode: a task id or FREE_FOCUS_KEY. */
  activeKey: string;
  guideDismissed: boolean;
}
