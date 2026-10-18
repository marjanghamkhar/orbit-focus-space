import { startOfDay } from './time';
import type { FocusSession } from './types';

/** Local-calendar day key, e.g. "2026-10-18". */
export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface DayActivity {
  minutes: number;
  sessions: FocusSession[];
}

/** Groups recorded focus sessions by the local day they were completed. Read-only. */
export function groupSessionsByDay(sessions: FocusSession[]): Map<string, DayActivity> {
  const map = new Map<string, DayActivity>();
  for (const s of sessions) {
    const key = dayKey(s.completedAt);
    const day = map.get(key) ?? { minutes: 0, sessions: [] };
    day.minutes += s.minutes;
    day.sessions.push(s);
    map.set(key, day);
  }
  for (const day of map.values()) day.sessions.sort((a, b) => a.completedAt - b.completedAt);
  return map;
}

export interface MonthRef {
  year: number;
  /** 0-11 */
  month: number;
}

export const monthOf = (t: number): MonthRef => {
  const d = new Date(t);
  return { year: d.getFullYear(), month: d.getMonth() };
};

export const addMonths = (m: MonthRef, delta: number): MonthRef => {
  const d = new Date(m.year, m.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};

export const sameMonth = (a: MonthRef, b: MonthRef) => a.year === b.year && a.month === b.month;

export const daysInMonth = (m: MonthRef) => new Date(m.year, m.month + 1, 0).getDate();

/** Local midnight of a given day in a month. */
export const dateInMonth = (m: MonthRef, day: number) => new Date(m.year, m.month, day).getTime();

export function formatMonth(m: MonthRef): string {
  return new Date(m.year, m.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** "Today", "Yesterday", or a full weekday + date. */
export function formatDayLabel(dayStart: number, now: number): string {
  const today = startOfDay(now);
  if (dayStart === today) return 'Today';
  if (dayStart === startOfDay(today - 1)) return 'Yesterday';
  return new Date(dayStart).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/** A rounded axis maximum so gridlines land on friendly numbers (15, 30, 60, 90, 120…). */
export function niceMax(value: number): number {
  const steps = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720, 960, 1200, 1440];
  return steps.find((s) => s >= value) ?? Math.ceil(value / 240) * 240;
}
