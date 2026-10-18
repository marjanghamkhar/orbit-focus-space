import type { FocusTimer } from './types';

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** mm:ss, rounding up so the display never shows 00:00 before the end. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function greeting(date: Date): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatTimeOfDay(t: number): string {
  return new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function getRemainingMs(timer: FocusTimer, now: number): number {
  if (timer.status === 'running' && timer.endsAt !== null) return Math.max(0, timer.endsAt - now);
  if (timer.status === 'completed') return 0;
  return timer.remainingMs;
}

/** 0 → 1, how much of the countdown has elapsed. */
export function getElapsedFraction(timer: FocusTimer, now: number): number {
  return 1 - getRemainingMs(timer, now) / (timer.duration * 60_000);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
