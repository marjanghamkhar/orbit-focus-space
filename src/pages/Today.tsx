import { useRef } from 'react';
import { EmptyState } from '../components/EmptyState';
import { FocusActivity } from '../components/FocusActivity';
import { Icon, type IconName } from '../components/Icon';
import { ProgressRing } from '../components/ProgressRing';
import { TaskItem } from '../components/TaskItem';
import { useNow } from '../hooks/useNow';
import { MAX_GOAL, MIN_GOAL } from '../lib/storage';
import { formatClock, formatLongDate, getRemainingMs, greeting, plural } from '../lib/time';
import { FREE_FOCUS_KEY } from '../lib/types';
import { getActiveTimer, isActiveStatus, selectTodayStats, sortTasks, titleForKey, useOrbit } from '../state/OrbitContext';
import { useUi } from '../state/UiContext';

const PREVIEW_COUNT = 4;

export function Today() {
  const { state, dispatch } = useOrbit();
  const { navigate } = useUi();
  const timer = getActiveTimer(state);
  const activeTitle = titleForKey(state, state.activeKey);
  const sessionActive = isActiveStatus(timer);
  // Re-render often while a session runs (for the live countdown), otherwise just enough to roll over the day.
  useNow(timer.status === 'running' ? 1000 : 30_000);
  // Always read the clock fresh: a ticker value can be stale (throttled background tab, sleep, midnight),
  // which would compare today's completions against the wrong day.
  const now = Date.now();
  const today = new Date(now);

  const stats = selectTodayStats(state, now);
  const goal = state.dailyGoal;
  const goalReached = stats.tasksDone >= goal;
  const openTasks = sortTasks(state.tasks.filter((t) => !t.completed));
  const preview = openTasks.slice(0, PREVIEW_COUNT);

  const progressMessage = goalReached
    ? 'Daily goal reached. Beautiful work today.'
    : stats.tasksDone > 0
      ? `${plural(goal - stats.tasksDone, 'more task')} to reach your goal.`
      : openTasks.length > 0
        ? 'Complete your first task to start filling your ring.'
        : 'Add a few tasks to plan your day.';

  const subtitle = goalReached
    ? 'You hit your goal — anything else is a bonus.'
    : openTasks.length === 0 && state.tasks.length === 0
      ? 'Let’s plan a calm, focused day.'
      : openTasks.length > 0
        ? `You have ${plural(openTasks.length, 'open task')}. Pick one and dive in.`
        : 'All caught up. Add something new or take a breather.';

  const startFocusing = () => {
    // With no session in progress and nothing chosen yet, open the top task's own timer.
    if (!sessionActive && state.activeKey === FREE_FOCUS_KEY && timer.status === 'idle' && openTasks[0]) {
      dispatch({ type: 'selectTimer', key: openTasks[0].id, now: Date.now() });
    }
    navigate('focus');
  };

  // Starter guide: checks off from real activity only.
  const steps: { label: string; detail: string; done: boolean; icon: IconName }[] = [
    { label: 'Plan', detail: 'Add your first task', done: state.tasks.length > 0 || state.sessions.length > 0, icon: 'tasks' },
    { label: 'Focus', detail: 'Finish a focus session', done: state.sessions.length > 0, icon: 'timer' },
    { label: 'Celebrate', detail: 'Complete a task', done: state.tasks.some((t) => t.completed), icon: 'sparkles' },
  ];
  const guideHidden = state.guideDismissed;

  // Keep keyboard focus on the toggle when it swaps between "Hide" and "Show getting started".
  const guideToggled = useRef(false);
  const focusIfToggled = (el: HTMLButtonElement | null) => {
    if (el && guideToggled.current) {
      guideToggled.current = false;
      el.focus();
    }
  };
  const setGuideHidden = (hidden: boolean) => {
    guideToggled.current = true;
    dispatch({ type: 'setGuideHidden', hidden });
  };

  return (
    <div className="page page--today">
      <header className="page-header">
        <div>
          <p className="eyebrow">{formatLongDate(today)}</p>
          <h1 id="page-title" tabIndex={-1}>
            {greeting(today)}
          </h1>
          <p className="page-header__sub">{subtitle}</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn--secondary" onClick={() => navigate('tasks')}>
            <Icon name="arrowLeft" size={16} />
            My Tasks
          </button>
          <button type="button" className="btn btn--primary btn--lg" onClick={startFocusing}>
            <Icon name={sessionActive ? 'timer' : 'play'} size={16} />
            {sessionActive ? 'Return to session' : 'Start focusing'}
          </button>
        </div>
      </header>

      {guideHidden ? (
        <div className="guide-restore">
          <button
            ref={focusIfToggled}
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setGuideHidden(false)}
            aria-expanded={false}
          >
            <Icon name="sparkles" size={14} />
            Show getting started
          </button>
        </div>
      ) : (
        <section className="card guide" aria-labelledby="guide-title">
          <div className="guide__head">
            <div>
              <h2 id="guide-title" className="card__title">
                Getting started
              </h2>
              <p className="card__sub">Orbit works in three simple steps. Each one checks off as you go.</p>
            </div>
            <button
              ref={focusIfToggled}
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setGuideHidden(true)}
              aria-expanded={true}
              aria-label="Hide getting started"
            >
              Hide
            </button>
          </div>
          <ol className="guide__steps">
            {steps.map((s, i) => (
              <li key={s.label} className={`guide__step ${s.done ? 'is-done' : ''}`}>
                <span className="guide__num" aria-hidden="true">
                  {s.done ? <Icon name="check" size={14} strokeWidth={3} /> : i + 1}
                </span>
                <span>
                  <span className="guide__label">{s.label}</span>
                  <span className="guide__detail">
                    {s.detail}
                    <span className="sr-only">{s.done ? ' — done' : ' — not done yet'}</span>
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="today-grid">
        <section className={`card progress-card ${goalReached ? 'is-reached' : ''}`} aria-labelledby="progress-title">
          <div className="progress-card__ring">
            <ProgressRing progress={stats.tasksDone / goal} size={164} stroke={14} tone={goalReached ? 'mint' : 'accent'}>
              {goalReached ? (
                <span className="progress-card__trophy">
                  <Icon name="trophy" size={26} />
                </span>
              ) : null}
              <span className="progress-card__value">
                {stats.tasksDone}
                <span className="progress-card__of">/{goal}</span>
              </span>
              <span className="progress-card__unit">tasks done</span>
            </ProgressRing>
          </div>

          <div className="progress-card__body">
            <h2 id="progress-title" className="card__title">
              Today’s progress
            </h2>
            <p className="progress-card__msg" aria-live="polite">
              {progressMessage}
            </p>

            <div className="goal">
              <span className="goal__label" id="goal-label">
                Daily goal
              </span>
              <div className="stepper" role="group" aria-labelledby="goal-label">
                <button
                  type="button"
                  className="stepper__btn"
                  onClick={() => dispatch({ type: 'setGoal', goal: goal - 1, now: Date.now() })}
                  disabled={goal <= MIN_GOAL}
                  aria-label="Decrease daily goal"
                >
                  <Icon name="minus" size={16} />
                </button>
                <output className="stepper__value" aria-live="polite">
                  {plural(goal, 'task')}
                </output>
                <button
                  type="button"
                  className="stepper__btn"
                  onClick={() => dispatch({ type: 'setGoal', goal: goal + 1, now: Date.now() })}
                  disabled={goal >= MAX_GOAL}
                  aria-label="Increase daily goal"
                >
                  <Icon name="plus" size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className={`card focus-cta ${sessionActive ? 'is-active' : ''}`} aria-labelledby="focus-cta-title">
          <div className="focus-cta__glow" aria-hidden="true" />
          <span className="focus-cta__icon" aria-hidden="true">
            <Icon name={sessionActive ? 'timer' : 'target'} size={20} />
          </span>
          {sessionActive ? (
            <>
              <h2 id="focus-cta-title" className="card__title">
                {timer.status === 'paused' ? 'Session paused' : 'Session in progress'}
              </h2>
              <p className="focus-cta__time">{formatClock(getRemainingMs(timer, now))}</p>
              <p className="focus-cta__text">
                {activeTitle ? (
                  <>
                    Focusing on <strong>{activeTitle}</strong>
                  </>
                ) : (
                  'Free focus — no task attached'
                )}
              </p>
            </>
          ) : (
            <>
              <h2 id="focus-cta-title" className="card__title">
                Ready to focus?
              </h2>
              <p className="focus-cta__text">
                {openTasks[0] ? (
                  <>
                    Up next: <strong>{openTasks[0].title}</strong>
                  </>
                ) : (
                  'Start a distraction-free timer for 15, 25 or 45 minutes.'
                )}
              </p>
            </>
          )}
          <button type="button" className="btn btn--primary focus-cta__btn" onClick={startFocusing}>
            {sessionActive ? 'Return to session' : 'Start a session'}
            <Icon name="arrowRight" size={16} />
          </button>
        </section>
      </div>

      <section className="stats" aria-label="Today’s statistics">
        <Stat icon="circleCheck" tone="mint" value={stats.tasksDone} label={stats.tasksDone === 1 ? 'Task completed' : 'Tasks completed'} />
        <Stat icon="zap" tone="accent" value={stats.sessions} label={stats.sessions === 1 ? 'Focus session' : 'Focus sessions'} />
        <Stat icon="clock" tone="coral" value={stats.focusMinutes} label="Focus minutes" />
      </section>

      <section className="card" aria-labelledby="upnext-title">
        <div className="card__head">
          <div>
            <h2 id="upnext-title" className="card__title">
              Up next
            </h2>
            <p className="card__sub">
              {openTasks.length > 0 ? `${plural(openTasks.length, 'task')} remaining` : 'Nothing on your list right now'}
            </p>
          </div>
          {state.tasks.length > 0 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('tasks')}>
              View all
              <Icon name="chevronRight" size={14} />
            </button>
          )}
        </div>

        {preview.length > 0 ? (
          <ul className="task-list">
            {preview.map((t) => (
              <TaskItem key={t.id} task={t} showDelete={false} />
            ))}
          </ul>
        ) : state.tasks.length === 0 ? (
          <EmptyState
            icon="inbox"
            title="Your day is a blank canvas"
            compact
            action={
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => navigate('tasks')}>
                <Icon name="plus" size={14} />
                Add tasks
              </button>
            }
          >
            Write down the two or three things that would make today feel good.
          </EmptyState>
        ) : (
          <EmptyState icon="circleCheck" title="Everything’s done" compact>
            Add another task, or enjoy a well-earned break.
          </EmptyState>
        )}

        {openTasks.length > PREVIEW_COUNT && (
          <button type="button" className="link-btn more-link" onClick={() => navigate('tasks')}>
            + {openTasks.length - PREVIEW_COUNT} more in My Tasks
          </button>
        )}
      </section>

      <FocusActivity />
    </div>
  );
}

function Stat({ icon, tone, value, label }: { icon: IconName; tone: 'mint' | 'accent' | 'coral'; value: number; label: string }) {
  return (
    <div className="card stat">
      <span className={`stat__icon stat__icon--${tone}`} aria-hidden="true">
        <Icon name={icon} size={18} />
      </span>
      <div>
        <div key={value} className="stat__value">
          {value}
        </div>
        <div className="stat__label">{label}</div>
      </div>
    </div>
  );
}
