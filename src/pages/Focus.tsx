import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EmptyState } from '../components/EmptyState';
import { Icon } from '../components/Icon';
import { ProgressRing } from '../components/ProgressRing';
import { useNow } from '../hooks/useNow';
import { clampDuration } from '../lib/storage';
import { formatClock, formatTimeOfDay, getRemainingMs, isSameDay, plural } from '../lib/time';
import { DURATION_PRESETS, FREE_FOCUS_KEY, MAX_DURATION, MIN_DURATION, PRIORITY_LABEL } from '../lib/types';
import { getActiveTimer, getTimer, sortTasks, titleForKey, useOrbit } from '../state/OrbitContext';
import { useUi } from '../state/UiContext';

function useRingSize() {
  const get = () => (window.innerWidth < 420 ? 248 : window.innerWidth < 860 ? 280 : 312);
  const [size, setSize] = useState(get);
  useEffect(() => {
    const onResize = () => setSize(get());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

const isPreset = (m: number) => (DURATION_PRESETS as readonly number[]).includes(m);

export function Focus() {
  const { state, dispatch } = useOrbit();
  const { navigate } = useUi();
  const activeKey = state.activeKey;
  const timer = getActiveTimer(state);
  const activeTitle = titleForKey(state, activeKey);
  const now = useNow(250, timer.status === 'running');
  const ringSize = useRingSize();
  const [confirmReset, setConfirmReset] = useState(false);
  const resetTimeout = useRef<number>();

  // Duration editing (always for the selected timer only).
  const [pendingMinutes, setPendingMinutes] = useState<number | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const isIdle = timer.status === 'idle';
  const isRunning = timer.status === 'running';
  const isPaused = timer.status === 'paused';
  const isActive = isRunning || isPaused;
  // The completion screen is only shown for a session that was actually recorded.
  const lastSession = state.sessions.find((s) => s.id === timer.lastSessionId) ?? null;
  const isDone = timer.status === 'completed' && lastSession !== null;
  const orphanedCompletion = timer.status === 'completed' && lastSession === null;
  useEffect(() => {
    if (orphanedCompletion) dispatch({ type: 'dismissCompletion' });
  }, [orphanedCompletion, dispatch]);

  const total = timer.duration * 60_000;
  const remaining = orphanedCompletion ? total : getRemainingMs(timer, now);
  const ringProgress = isDone ? 1 : remaining / total;

  const openTasks = sortTasks(state.tasks.filter((t) => !t.completed));
  const activeTask = state.tasks.find((t) => t.id === activeKey) ?? null;
  const todaySessions = state.sessions
    .filter((s) => isSameDay(s.completedAt, now))
    .sort((a, b) => b.completedAt - a.completedAt);
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.minutes, 0);

  // Leaving the selected timer (or it no longer being paused) cancels any half-made duration change.
  useEffect(() => {
    setPendingMinutes(null);
    setCustomOpen(false);
  }, [activeKey]);
  useEffect(() => {
    if (!isPaused) setPendingMinutes(null);
  }, [isPaused]);

  const shownMinutes = pendingMinutes ?? timer.duration;
  const customSelected = customOpen || !isPreset(shownMinutes);

  const chooseDuration = (minutes: number) => {
    const m = clampDuration(minutes);
    if (isRunning) return; // Must pause first.
    if (isPaused) {
      // Changing a paused timer is an explicit choice: restart with the new length, or resume as is.
      setPendingMinutes(m === timer.duration ? null : m);
      return;
    }
    dispatch({ type: 'setDuration', minutes: m });
  };

  const openCustom = () => {
    setCustomOpen(true);
    setCustomValue(String(shownMinutes));
  };

  const submitCustom = (e: FormEvent) => {
    e.preventDefault();
    const value = Number.parseInt(customValue, 10);
    if (!Number.isFinite(value)) return;
    chooseDuration(value);
    setCustomValue(String(clampDuration(value)));
  };

  const primary = () => {
    const t = Date.now();
    if (timer.status === 'idle') dispatch({ type: 'startTimer', now: t });
    else if (timer.status === 'running') dispatch({ type: 'pauseTimer', now: t });
    else if (timer.status === 'paused') dispatch({ type: 'resumeTimer', now: t });
  };

  const reset = () => {
    // Two-step reset: an unfinished session is discarded, so make that intentional.
    if (!confirmReset) {
      setConfirmReset(true);
      window.clearTimeout(resetTimeout.current);
      resetTimeout.current = window.setTimeout(() => setConfirmReset(false), 3500);
      return;
    }
    window.clearTimeout(resetTimeout.current);
    setConfirmReset(false);
    dispatch({ type: 'resetTimer' });
  };

  useEffect(() => () => window.clearTimeout(resetTimeout.current), []);
  useEffect(() => {
    if (!isActive) setConfirmReset(false);
  }, [isActive, activeKey]);

  // Space toggles start / pause / resume when not typing or on another control.
  const primaryRef = useRef(primary);
  primaryRef.current = primary;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && el.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      e.preventDefault();
      primaryRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** Each task's own saved progress, shown in the task picker. */
  const optionSuffix = (key: string) => {
    const t = getTimer(state, key);
    if (key === activeKey) return '';
    if (t.status === 'paused') return ` · paused, ${formatClock(t.remainingMs)} left`;
    if (t.status === 'running') return ' · running';
    return '';
  };

  const statusLabel = isDone ? 'Complete' : isRunning ? 'Focusing' : isPaused ? 'Paused' : 'Ready';
  const taskStillOpen = lastSession?.taskId ? state.tasks.some((t) => t.id === lastSession.taskId && !t.completed) : false;
  const taskWasCompleted = lastSession?.taskId ? state.tasks.some((t) => t.id === lastSession.taskId && t.completed) : false;

  return (
    <div className="page page--focus">
      <header className="page-header">
        <div>
          <p className="eyebrow">Focus</p>
          <h1 id="page-title" tabIndex={-1}>
            Focus mode
          </h1>
          <p className="page-header__sub">
            {isActive
              ? 'Your session keeps running if you switch sections — come back anytime.'
              : isDone
                ? 'Take a breath. Your progress has been saved.'
                : 'Pick a task, choose a length, and press start.'}
          </p>
        </div>
        <button type="button" className="btn btn--secondary page-header__back" onClick={() => navigate('tasks')}>
          <Icon name="arrowLeft" size={16} />
          My Tasks
        </button>
      </header>

      <div className="focus-layout">
        <section className={`card focus-card is-${timer.status}`} aria-label="Focus timer">
          {/* Task + duration setup */}
          {!isDone && (
            <div className="focus-setup">
              <div className="field">
                <label htmlFor="focus-task" className="field__label">
                  What are you focusing on?
                </label>
                <div className="select">
                  <select
                    id="focus-task"
                    value={activeKey}
                    onChange={(e) => dispatch({ type: 'selectTimer', key: e.target.value, now: Date.now() })}
                  >
                    <option value={FREE_FOCUS_KEY}>No specific task — just focus{optionSuffix(FREE_FOCUS_KEY)}</option>
                    {activeTask?.completed && (
                      <option value={activeTask.id}>{activeTask.title} · Done</option>
                    )}
                    {openTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} · {PRIORITY_LABEL[t.priority]}
                        {optionSuffix(t.id)}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevronRight" size={16} className="select__chevron" />
                </div>
                {openTasks.length === 0 && (
                  <p className="field__hint">
                    No open tasks.{' '}
                    <button type="button" className="link-btn" onClick={() => navigate('tasks')}>
                      Add one in My Tasks
                    </button>{' '}
                    or start a free session.
                  </p>
                )}
              </div>

              <fieldset className="durations" disabled={isRunning}>
                <legend className="field__label">Session length</legend>
                <div className="durations__options">
                  {DURATION_PRESETS.map((d) => (
                    <label key={d} className="duration">
                      <input
                        type="radio"
                        name="duration"
                        value={d}
                        checked={!customSelected && shownMinutes === d}
                        onChange={() => {
                          setCustomOpen(false);
                          chooseDuration(d);
                        }}
                      />
                      <span>
                        <strong>{d}</strong> min
                      </span>
                    </label>
                  ))}
                  <label className="duration">
                    <input type="radio" name="duration" value="custom" checked={customSelected} onChange={openCustom} />
                    <span>{customSelected && !customOpen ? <><strong>{shownMinutes}</strong> min</> : 'Custom'}</span>
                  </label>
                </div>
              </fieldset>

              {isRunning && <p className="focus-setup__note">Pause the timer to change this task’s duration.</p>}

              {customOpen && !isRunning && (
                <form className="custom-duration" onSubmit={submitCustom}>
                  <label htmlFor="custom-minutes" className="custom-duration__label">
                    Custom length
                  </label>
                  <input
                    id="custom-minutes"
                    className="custom-duration__input"
                    type="number"
                    inputMode="numeric"
                    min={MIN_DURATION}
                    max={MAX_DURATION}
                    step={1}
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    autoFocus
                  />
                  <span className="custom-duration__unit">min</span>
                  <button type="submit" className="btn btn--secondary btn--sm" disabled={!customValue}>
                    Set
                  </button>
                  <span className="custom-duration__hint">
                    {MIN_DURATION}–{MAX_DURATION} minutes
                  </span>
                </form>
              )}

              {isPaused && pendingMinutes !== null && (
                <div className="duration-change" role="group" aria-label="Apply new session length">
                  <p className="duration-change__text">
                    Change to <strong>{pendingMinutes} min</strong>? Restarting discards the{' '}
                    <strong>{formatClock(remaining)}</strong> left in this session — it won’t be recorded.
                  </p>
                  <div className="duration-change__actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => dispatch({ type: 'restartWithDuration', minutes: pendingMinutes, now: Date.now() })}
                    >
                      <Icon name="reset" size={14} />
                      Restart at {pendingMinutes}:00
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        setPendingMinutes(null);
                        setCustomOpen(false);
                        dispatch({ type: 'resumeTimer', now: Date.now() });
                      }}
                    >
                      <Icon name="play" size={12} />
                      Resume {formatClock(remaining)} left
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Centerpiece */}
          <div className="focus-ring-wrap">
            {isDone && (
              <div className="burst" aria-hidden="true" style={{ ['--r' as string]: `${ringSize / 2 + 26}px` }}>
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} style={{ ['--i' as string]: i }} />
                ))}
              </div>
            )}
            <ProgressRing
              progress={ringProgress}
              size={ringSize}
              stroke={ringSize > 300 ? 16 : 14}
              tone={isDone ? 'mint' : 'accent'}
              motion={isRunning ? 'linear' : 'ease'}
              className={`focus-ring ${isRunning ? 'is-running' : ''}`}
            >
              {isDone ? (
                <div className="focus-ring__done">
                  <span className="focus-ring__check">
                    <Icon name="check" size={30} strokeWidth={2.6} />
                  </span>
                  <span className="focus-ring__plus">+{lastSession?.minutes} min</span>
                  <span className="focus-ring__status">Session complete</span>
                </div>
              ) : (
                <>
                  <span className={`focus-ring__status focus-ring__status--${timer.status}`}>
                    {isRunning && <span className="pulse" aria-hidden="true" />}
                    {statusLabel}
                  </span>
                  <span
                    className="focus-ring__time"
                    role="timer"
                    aria-label={`${formatClock(remaining)} remaining${activeTitle ? ` for ${activeTitle}` : ''}`}
                    aria-live="off"
                  >
                    {formatClock(remaining)}
                  </span>
                  <span className="focus-ring__total">of {formatClock(total)}</span>
                </>
              )}
            </ProgressRing>
          </div>

          {/* Controls */}
          {isDone ? (
            <div className="completion">
              <h2 className="completion__title">Nice work — that’s focus well spent.</h2>
              <p className="completion__text">
                You focused for {plural(lastSession?.minutes ?? 0, 'minute')}
                {lastSession?.taskTitle ? (
                  <>
                    {' '}
                    on <strong>{lastSession.taskTitle}</strong>
                  </>
                ) : null}
                . It’s been added to today’s stats.
              </p>
              <div className="completion__actions">
                {taskStillOpen && lastSession?.taskId && (
                  <button
                    type="button"
                    className="btn btn--mint btn--lg"
                    onClick={() => dispatch({ type: 'toggleTask', id: lastSession.taskId!, now: Date.now() })}
                  >
                    <Icon name="check" size={16} strokeWidth={2.6} />
                    Mark task as done
                  </button>
                )}
                {taskWasCompleted && (
                  <span className="completion__done-note">
                    <Icon name="circleCheck" size={16} /> Task completed
                  </span>
                )}
                <button
                  type="button"
                  className={`btn btn--lg ${taskStillOpen ? 'btn--secondary' : 'btn--primary'}`}
                  onClick={() => dispatch({ type: 'dismissCompletion' })}
                >
                  <Icon name="reset" size={16} />
                  Start another session
                </button>
                <button type="button" className="btn btn--ghost btn--lg" onClick={() => navigate('today')}>
                  See today’s progress
                </button>
              </div>
            </div>
          ) : (
            <div className="controls">
              <div className="controls__row">
                {isActive && (
                  <button
                    type="button"
                    className={`btn btn--secondary btn--lg ${confirmReset ? 'btn--danger-soft' : ''}`}
                    onClick={reset}
                    aria-label={confirmReset ? 'Confirm reset. This session will not be recorded.' : 'Reset timer'}
                  >
                    <Icon name="reset" size={16} />
                    {confirmReset ? 'Tap again to discard' : 'Reset'}
                  </button>
                )}
                <button type="button" className="btn btn--primary btn--xl controls__primary" onClick={primary}>
                  <Icon name={isRunning ? 'pause' : 'play'} size={18} />
                  {isIdle ? 'Start focus' : isRunning ? 'Pause' : 'Resume'}
                </button>
              </div>
              <p className={`controls__hint ${confirmReset ? '' : 'controls__hint--keyboard'}`}>
                {confirmReset ? (
                  'Resetting discards this session — only finished sessions count.'
                ) : (
                  <>
                    Press <kbd>Space</kbd> to {isRunning ? 'pause' : isPaused ? 'resume' : 'start'}
                  </>
                )}
              </p>
            </div>
          )}
        </section>

        <aside className="focus-side">
          <section className="card" aria-labelledby="sessions-title">
            <h2 id="sessions-title" className="card__title">
              Today’s focus
            </h2>
            <div className="focus-summary">
              <div>
                <span className="focus-summary__value">{todayMinutes}</span>
                <span className="focus-summary__label">minutes</span>
              </div>
              <div>
                <span className="focus-summary__value">{todaySessions.length}</span>
                <span className="focus-summary__label">{todaySessions.length === 1 ? 'session' : 'sessions'}</span>
              </div>
            </div>

            {todaySessions.length > 0 ? (
              <ul className="session-list">
                {todaySessions.map((s) => (
                  <li key={s.id} className={`session-item ${s.id === timer.lastSessionId ? 'is-new' : ''}`}>
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
              <EmptyState icon="clock" title="No sessions yet today" compact>
                Finished sessions appear here. Only full countdowns count.
              </EmptyState>
            )}
          </section>

          {isIdle && activeKey === FREE_FOCUS_KEY && openTasks.length > 0 && (
            <div className="tip">
              <Icon name="sparkles" size={16} />
              <span>Tip: attach a task so you know exactly what this session is for.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
