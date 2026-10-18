import { useId, useState, type FormEvent } from 'react';
import { PRIORITIES, PRIORITY_LABEL, type Priority } from '../lib/types';
import { useOrbit } from '../state/OrbitContext';
import { Icon } from './Icon';

let counter = 0;
export const newTaskId = () => `task-${Date.now().toString(36)}-${(counter++).toString(36)}`;

interface AddTaskFormProps {
  /** Compact single-row variant. */
  compact?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

export function AddTaskForm({ compact, autoFocus, placeholder = 'What do you want to get done?' }: AddTaskFormProps) {
  const { dispatch } = useOrbit();
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [justAdded, setJustAdded] = useState(false);
  const id = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    dispatch({
      type: 'addTask',
      task: { id: newTaskId(), title: trimmed.slice(0, 200), priority, completed: false, createdAt: Date.now(), completedAt: null },
    });
    setTitle('');
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 600);
  };

  return (
    <form className={`add-task ${compact ? 'add-task--compact' : ''} ${justAdded ? 'is-added' : ''}`} onSubmit={submit}>
      <label htmlFor={`${id}-title`} className="sr-only">
        Task title
      </label>
      <div className="add-task__input-wrap">
        <Icon name="plus" size={18} className="add-task__icon" />
        <input
          id={`${id}-title`}
          className="add-task__input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          maxLength={200}
          autoComplete="off"
          autoFocus={autoFocus}
        />
      </div>

      <div className="add-task__row">
        {!compact && (
          <fieldset className="segmented" aria-label="Priority">
            <legend className="sr-only">Priority</legend>
            {PRIORITIES.map((p) => (
              <label key={p} className={`segmented__option segmented__option--${p}`}>
                <input
                  type="radio"
                  name={`${id}-priority`}
                  value={p}
                  checked={priority === p}
                  onChange={() => setPriority(p)}
                />
                <span>
                  <i className={`dot dot--${p}`} aria-hidden="true" />
                  {PRIORITY_LABEL[p]}
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <button type="submit" className="btn btn--primary" disabled={!title.trim()}>
          {compact ? 'Add' : 'Add task'}
        </button>
      </div>
    </form>
  );
}
