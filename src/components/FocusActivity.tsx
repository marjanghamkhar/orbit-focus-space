import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNow } from '../hooks/useNow';
import {
  addMonths,
  dateInMonth,
  dayKey,
  daysInMonth,
  formatDayLabel,
  formatMonth,
  groupSessionsByDay,
  monthOf,
  niceMax,
  sameMonth,
  type MonthRef,
} from '../lib/activity';
import { formatTimeOfDay, plural, startOfDay } from '../lib/time';
import { useOrbit } from '../state/OrbitContext';
import { EmptyState } from './EmptyState';
import { Icon } from './Icon';

interface DayCell {
  day: number;
  start: number;
  minutes: number;
  count: number;
  tasksDone: number;
  goal: number | null;
  goalMet: boolean;
  future: boolean;
  isToday: boolean;
}

const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const longDate = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
/** Display long sessions in hours without implying a 60-minute cap. */
const displayDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${minutes} min` : rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
};
const axisDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${minutes}m` : rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
};
const describe = (d: DayCell) => {
  const focus = d.count > 0 ? `${displayDuration(d.minutes)} focused, ${plural(d.count, 'session')}` : 'No focus sessions';
  const goals = d.goalMet ? 'Daily task goal achieved' : `${plural(d.tasksDone, 'task')} completed`;
  return `${focus}; ${goals}`;
};

/** Weekday initials, Monday first (2024-01-01 was a Monday). */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => ({
  narrow: new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' }),
  long: new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'long' }),
}));

/**
 * Overview "Focus activity": daily focus minutes for a month (bar chart), a month calendar,
 * and the selected day's details. Reads recorded sessions only — never writes state.
 */
export function FocusActivity() {
  const { state } = useOrbit();
  useNow(60_000); // re-render now and then so "today" rolls over at midnight
  const today = startOfDay(Date.now());
  const currentMonth = monthOf(today);

  const [selected, setSelected] = useState(today);
  const [view, setView] = useState<MonthRef>(currentMonth);

  const byDay = useMemo(() => groupSessionsByDay(state.sessions), [state.sessions]);
  const tasksByDay = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of state.tasks) {
      if (task.completed && task.completedAt !== null) {
        const key = dayKey(task.completedAt);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return counts;
  }, [state.tasks]);

  const days: DayCell[] = Array.from({ length: daysInMonth(view) }, (_, i) => {
    const start = dateInMonth(view, i + 1);
    const key = dayKey(start);
    const activity = byDay.get(key);
    const tasksDone = tasksByDay.get(key) ?? 0;
    const achievedGoal = state.goalAchievements[key];
    const isToday = start === today;
    return {
      day: i + 1,
      start,
      minutes: activity?.minutes ?? 0,
      count: activity?.sessions.length ?? 0,
      tasksDone,
      goal: achievedGoal ?? (isToday ? state.dailyGoal : null),
      goalMet: isToday ? tasksDone >= state.dailyGoal : achievedGoal !== undefined,
      future: start > today,
      isToday,
    };
  });

  const monthMinutes = days.reduce((sum, d) => sum + d.minutes, 0);
  const activeDays = days.filter((d) => d.count > 0).length;
  const monthLabel = formatMonth(view);
  const isCurrentMonth = sameMonth(view, currentMonth);
  const viewIsFuture = view.year > currentMonth.year || (view.year === currentMonth.year && view.month >= currentMonth.month);

  const select = (start: number) => {
    if (start > today) return;
    setSelected(start);
    const m = monthOf(start);
    if (!sameMonth(m, view)) setView(m);
  };

  const goToMonth = (delta: number) => {
    const next = addMonths(view, delta);
    setView(next);
    // Keep the selection inside the visible month: same day number, clamped to the month and to today.
    const day = Math.min(new Date(selected).getDate(), daysInMonth(next));
    setSelected(Math.min(dateInMonth(next, day), today));
  };

  const goToToday = () => {
    setView(currentMonth);
    setSelected(today);
  };

  const selectedActivity = byDay.get(dayKey(selected));
  const selectedMinutes = selectedActivity?.minutes ?? 0;
  const selectedSessions = selectedActivity?.sessions ?? [];
  const selectedLabel = formatDayLabel(selected, today);
  const selectedDay = days.find((d) => d.start === selected);
  const selectedTasksDone = selectedDay?.tasksDone ?? tasksByDay.get(dayKey(selected)) ?? 0;
  const selectedGoalReached = selectedDay?.goalMet ?? state.goalAchievements[dayKey(selected)] !== undefined;

  return (
    <div className="activity-sections">
      <section className="card activity-card activity-card--chart" aria-labelledby="activity-title">
      <div className="card__head activity__head">
        <div>
          <h2 id="activity-title" className="card__title">
            Focus activity
          </h2>
          <p className="card__sub" aria-live="polite">
            {monthMinutes > 0
              ? `${displayDuration(monthMinutes)} across ${plural(activeDays, 'day')} in ${monthLabel}`
              : `No focus sessions recorded in ${monthLabel}`}
          </p>
        </div>
        <div className="month-nav">
          {(!isCurrentMonth || selected !== today) && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={goToToday}>
              Today
            </button>
          )}
          <button type="button" className="icon-btn month-nav__btn" onClick={() => goToMonth(-1)} aria-label="Previous month">
            <Icon name="chevronRight" size={16} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <span className="month-nav__label">{monthLabel}</span>
          <button
            type="button"
            className="icon-btn month-nav__btn"
            onClick={() => goToMonth(1)}
            disabled={viewIsFuture}
            aria-label="Next month"
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </div>

        <FocusChart days={days} selected={selected} onSelect={select} monthLabel={monthLabel} />
      </section>

      <section className="card activity-card activity-card--calendar" aria-labelledby="calendar-title">
        <div className="activity-calendar__header">
          <div>
            <h2 id="calendar-title" className="card__title">Daily goals calendar</h2>
            <p className="card__sub">Green days mean you reached your task goal. Select a date to explore your progress.</p>
          </div>
          <span className="activity-calendar__month">{monthLabel}</span>
        </div>

        <MonthCalendar view={view} days={days} selected={selected} onSelect={select} />

        <div className="day-detail" aria-live="polite">
        <div className="day-detail__summary">
          <div className="day-detail__title">
            <h3>{selectedLabel}</h3>
            <span>{selectedLabel === 'Today' || selectedLabel === 'Yesterday' ? longDate(selected) : new Date(selected).getFullYear()}</span>
          </div>
          <div className="day-detail__stats">
            <div>
              <span className="day-detail__value">{displayDuration(selectedMinutes)}</span>
              <span className="day-detail__label">focus time</span>
            </div>
            <div>
              <span className="day-detail__value">{selectedSessions.length}</span>
              <span className="day-detail__label">{selectedSessions.length === 1 ? 'session' : 'sessions'}</span>
            </div>
          </div>
          <p className={`day-detail__goal ${selectedGoalReached ? 'is-achieved' : ''}`}>
            {selectedGoalReached ? (
              <>
                <Icon name="check" size={14} /> Daily task goal reached
              </>
            ) : selected === today ? (
              `${selectedTasksDone} of ${state.dailyGoal} tasks completed toward today's goal`
            ) : (
              `${plural(selectedTasksDone, 'task')} completed`
            )}
          </p>
        </div>

        {selectedSessions.length > 0 ? (
          <ul className="session-list day-detail__list">
            {selectedSessions.map((s) => (
              <li key={s.id} className="session-item">
                <span className="session-item__icon" aria-hidden="true">
                  <Icon name="check" size={13} strokeWidth={3} />
                </span>
                <span className="session-item__body">
                  <span className="session-item__task">{s.taskTitle ?? 'Free focus'}</span>
                  <span className="session-item__time">{formatTimeOfDay(s.completedAt)}</span>
                </span>
                <span className="session-item__min">{s.minutes} min</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="day-detail__list">
            <EmptyState icon="clock" title={selected === today ? 'No focus sessions yet today' : 'No focus sessions this day'} compact>
              {selected === today
                ? 'Finish a focus session and it will show up here.'
                : 'Nothing was recorded on this day — and that’s okay. Rest days count too.'}
            </EmptyState>
          </div>
        )}
        </div>
      </section>
    </div>
  );
}

/** Roving-tabindex keyboard navigation shared by the chart and calendar. */
function useRovingKeys(days: DayCell[], selected: number, onSelect: (t: number) => void, vertical: number) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = days.findIndex((d) => d.start === selected);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta =
      e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : vertical && e.key === 'ArrowDown' ? vertical : vertical && e.key === 'ArrowUp' ? -vertical : 0;
    let target = delta ? i + delta : e.key === 'Home' ? 0 : e.key === 'End' ? days.length - 1 : -1;
    if (target === -1) return;
    e.preventDefault();
    target = Math.max(0, Math.min(days.length - 1, target));
    // Never move onto a future day.
    while (target > 0 && days[target].future) target--;
    onSelect(days[target].start);
    refs.current[target]?.focus();
  };
  // When the selection isn't in this month, the first day takes the tab stop.
  const tabStop = index === -1 ? 0 : index;
  return { refs, onKeyDown, tabStop };
}

function FocusChart({
  days,
  selected,
  onSelect,
  monthLabel,
}: {
  days: DayCell[];
  selected: number;
  onSelect: (t: number) => void;
  monthLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const { refs, onKeyDown, tabStop } = useRovingKeys(days, selected, onSelect, 0);
  const peak = Math.max(0, ...days.map((d) => d.minutes));
  const max = peak > 0 ? niceMax(peak) : 1;
  const empty = peak === 0;
  const ticks = [1, 8, 15, 22, 29].filter((d) => d <= days.length);
  const tip = hover !== null ? days[hover] : null;

  return (
    <div className="chart">
      <div className="chart__caption">
        <div className="chart__caption-main">
          <span className="chart__legend-swatch" aria-hidden="true" />
          <strong>Daily focus time</strong>
        </div>
        <span>Each bar represents one day · Scales to your activity</span>
      </div>
      <div className="chart__plot" onMouseLeave={() => setHover(null)}>
        <div className="chart__grid" aria-hidden="true">
          {[1, 0.75, 0.5, 0.25, 0].map((f) => (
            <div key={f} className="chart__gridline" style={{ bottom: `${f * 100}%` }}>
              <span className="chart__ylabel">{empty ? (f === 0 ? '0' : '') : axisDuration(Math.round(max * f))}</span>
            </div>
          ))}
        </div>

        <div className="chart__bars" role="group" aria-label={`Daily focus minutes, ${monthLabel}`}>
          {days.map((d, i) => (
            <button
              key={d.day}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              className={`chart__col ${d.start === selected ? 'is-selected' : ''} ${d.isToday ? 'is-today' : ''} ${d.minutes > 0 ? 'has-bar' : ''}`}
              disabled={d.future}
              tabIndex={i === tabStop ? 0 : -1}
              aria-pressed={d.start === selected}
              aria-label={`${shortDate(d.start)}${d.isToday ? ' (today)' : ''}: ${describe(d)}`}
              onClick={() => onSelect(d.start)}
              onKeyDown={(e) => onKeyDown(e, i)}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            >
              {d.minutes > 0 && <span className="chart__bar" style={{ height: `${(d.minutes / max) * 100}%` }} />}
            </button>
          ))}
        </div>

        {tip && !tip.future && (
          <div
            className={`chart__tip ${hover! < 4 ? 'is-start' : hover! > days.length - 5 ? 'is-end' : ''}`}
            style={{ left: `${((hover! + 0.5) / days.length) * 100}%` }}
            aria-hidden="true"
          >
            <span className="chart__tip-date">
              {shortDate(tip.start)}
              {tip.isToday ? ' · Today' : ''}
            </span>
            <span className="chart__tip-value">{tip.count > 0 ? `${displayDuration(tip.minutes)} · ${plural(tip.count, 'session')}` : 'No focus'}</span>
          </div>
        )}

        {empty && (
          <div className="chart__empty">
            <Icon name="zap" size={16} />
            <span>Your chart starts with your first completed focus session</span>
          </div>
        )}
      </div>

      <div className="chart__x" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: `${((t - 0.5) / days.length) * 100}%` }}>
            {shortDate(days[t - 1].start)}
          </span>
        ))}
      </div>

      <div className="chart__footnote">Tap a day in the chart to see its focus time and tasks below.</div>

      <table className="sr-only">
        <caption>Focus minutes per day, {monthLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Minutes</th>
            <th scope="col">Sessions</th>
          </tr>
        </thead>
        <tbody>
          {days
            .filter((d) => !d.future)
            .map((d) => (
              <tr key={d.day}>
                <th scope="row">{shortDate(d.start)}</th>
                <td>{d.minutes}</td>
                <td>{d.count}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function MonthCalendar({
  view,
  days,
  selected,
  onSelect,
}: {
  view: MonthRef;
  days: DayCell[];
  selected: number;
  onSelect: (t: number) => void;
}) {
  const { refs, onKeyDown, tabStop } = useRovingKeys(days, selected, onSelect, 7);
  // Monday-first offset of the 1st of the month.
  const offset = (new Date(view.year, view.month, 1).getDay() + 6) % 7;

  return (
    <div className="cal">
      <div className="cal__weekdays" aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <span key={w.long}>{w.narrow}</span>
        ))}
      </div>
      <div className="cal__grid" role="group" aria-label={`Calendar, ${formatMonth(view)}`}>
        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} aria-hidden="true" />
        ))}
        {days.map((d, i) => (
          <button
            key={d.day}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            className={`cal__day ${d.isToday ? 'is-today' : ''} ${d.start === selected ? 'is-selected' : ''} ${d.goalMet ? 'is-goal-met' : ''} ${d.count > 0 ? 'has-activity' : ''}`}
            disabled={d.future}
            tabIndex={i === tabStop ? 0 : -1}
            aria-pressed={d.start === selected}
            aria-current={d.isToday ? 'date' : undefined}
            aria-label={`${longDate(d.start)}${d.isToday ? ', today' : ''}: ${describe(d)}`}
            onClick={() => onSelect(d.start)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <span className="cal__num">{d.day}</span>
            <span className="cal__dot" aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="cal__legend" aria-hidden="true">
        <span>
          <i className="cal__legend-goal" /> Daily task goal met
        </span>
        <span>
          <i className="cal__legend-dot" /> Focus recorded
        </span>
        <span>
          <i className="cal__legend-today" /> Today
        </span>
      </div>
    </div>
  );
}
