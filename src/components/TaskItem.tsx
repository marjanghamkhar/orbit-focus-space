import { useNow } from '../hooks/useNow';
import { formatClock, getElapsedFraction, getRemainingMs } from '../lib/time';
import { PRIORITY_LABEL, type FocusTimer, type Task } from '../lib/types';
import { isActiveStatus, useOrbit } from '../state/OrbitContext';
import { useUi } from '../state/UiContext';
import { Icon } from './Icon';

interface TaskItemProps {
  task: Task;
  showDelete?: boolean;
}

/** This task's own timer progress. Shown once a session has been started for the task. */
function TaskTimerProgress({ timer }: { timer: FocusTimer }) {
  const now = useNow(250, timer.status === 'running');
  const remaining = getRemainingMs(timer, now);
  const done = timer.status === 'completed';
  const paused = timer.status === 'paused';
  const label = done
    ? 'Focus session complete'
    : `${paused ? 'Paused' : 'Focusing'}: ${formatClock(remaining)} left of ${timer.duration} minutes`;

  return (
    <span
      className={`task-progress ${paused ? 'is-paused' : ''} ${done ? 'is-done' : ''}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <span className="task-progress__ring" style={{ ['--p' as string]: done ? 1 : getElapsedFraction(timer, now) }} aria-hidden="true" />
      <span className="task-progress__time" aria-hidden="true">
        {done ? 'Done' : formatClock(remaining)}
      </span>
    </span>
  );
}

export function TaskItem({ task, showDelete = true }: TaskItemProps) {
  const { state, dispatch } = useOrbit();
  const { navigate, showToast } = useUi();
  const checkboxId = `check-${task.id}`;
  const timer = state.timers[task.id];
  const showProgress =
    timer !== undefined &&
    timer.status !== 'idle' &&
    (timer.status !== 'completed' || state.sessions.some((s) => s.id === timer.lastSessionId));
  const inFocus = state.activeKey === task.id && timer !== undefined && isActiveStatus(timer);

  const toggle = () => dispatch({ type: 'toggleTask', id: task.id, now: Date.now() });

  const focusOnTask = () => {
    dispatch({ type: 'selectTimer', key: task.id, now: Date.now() });
    navigate('focus');
  };

  const remove = () => {
    const index = state.tasks.findIndex((t) => t.id === task.id);
    const timerSnapshot = state.timers[task.id] ?? null;
    dispatch({ type: 'deleteTask', id: task.id });
    showToast({
      message: 'Task deleted',
      actionLabel: 'Undo',
      onAction: () => dispatch({ type: 'restoreTask', task, index, timer: timerSnapshot, now: Date.now() }),
    });
  };

  return (
    <li className={`task ${task.completed ? 'task--done' : ''} ${inFocus ? 'task--focus' : ''}`}>
      <input id={checkboxId} type="checkbox" className="check" checked={task.completed} onChange={toggle} />
      <label htmlFor={checkboxId} className="task__label">
        <span className="check__box" aria-hidden="true">
          <Icon name="check" size={13} strokeWidth={3} />
        </span>
        <span className="task__title">{task.title}</span>
        <span className="sr-only">, {PRIORITY_LABEL[task.priority]} priority</span>
      </label>

      <div className="task__meta">
        <span className={`badge badge--${task.priority}`} aria-hidden="true">
          <i className={`dot dot--${task.priority}`} />
          {PRIORITY_LABEL[task.priority]}
        </span>
      </div>

      <div className="task__actions">
        {showProgress && <TaskTimerProgress timer={timer} />}
        {!task.completed && (
          <button
            type="button"
            className="icon-btn icon-btn--accent"
            onClick={focusOnTask}
            aria-label={`Open focus mode for “${task.title}”`}
            title="Focus on this task"
          >
            <Icon name="play" size={14} />
          </button>
        )}
        {showDelete && (
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={remove}
            aria-label={`Delete “${task.title}”`}
            title="Delete task"
          >
            <Icon name="trash" size={16} />
          </button>
        )}
      </div>
    </li>
  );
}
