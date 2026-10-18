import { useState } from 'react';
import { AddTaskForm } from '../components/AddTaskForm';
import { EmptyState } from '../components/EmptyState';
import { TaskItem } from '../components/TaskItem';
import { Icon } from '../components/Icon';
import { useUi } from '../state/UiContext';
import { plural } from '../lib/time';
import { sortTasks, useOrbit } from '../state/OrbitContext';

type Filter = 'all' | 'active' | 'completed';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
];

export function Tasks() {
  const { state } = useOrbit();
  const { navigate } = useUi();
  const [filter, setFilter] = useState<Filter>('all');

  const counts = {
    all: state.tasks.length,
    active: state.tasks.filter((t) => !t.completed).length,
    completed: state.tasks.filter((t) => t.completed).length,
  };

  const visible = sortTasks(
    state.tasks.filter((t) => (filter === 'all' ? true : filter === 'active' ? !t.completed : t.completed)),
  );

  return (
    <div className="page page--tasks">
      <header className="page-header page-header--tasks">
        <div>
          <p className="eyebrow">ORBIT · YOUR FOCUS SPACE</p>
          <h1 id="page-title" tabIndex={-1}>
            My Tasks
          </h1>
          <p className="page-header__sub">
            {counts.all === 0
              ? 'Capture what matters today. Keep it short — three focused tasks beat ten vague ones.'
              : `${plural(counts.active, 'open task')} · ${counts.completed} completed`}
          </p>
        </div>
        <nav className="workspace-links" aria-label="Explore Orbit">
          <button type="button" className="workspace-link" onClick={() => navigate('today')}>
            <Icon name="home" size={16} />
            Overview
          </button>
          <button type="button" className="workspace-link workspace-link--accent" onClick={() => navigate('focus')}>
            <Icon name="timer" size={16} />
            Focus
          </button>
        </nav>
      </header>

      <section className="card card--flush-bottom" aria-label="Add a task">
        <AddTaskForm autoFocus={counts.all === 0} />
      </section>

      <section className="card" aria-labelledby="list-title">
        <div className="card__head">
          <h2 id="list-title" className="card__title">
            Your list
          </h2>
          <div className="filters" role="group" aria-label="Filter tasks">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`filters__btn ${filter === f.id ? 'is-active' : ''}`}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                <span className="filters__count">{counts[f.id]}</span>
              </button>
            ))}
          </div>
        </div>

        {visible.length > 0 ? (
          <ul className="task-list" aria-label={`${FILTERS.find((f) => f.id === filter)!.label} tasks`}>
            {visible.map((t) => (
              <TaskItem key={t.id} task={t} />
            ))}
          </ul>
        ) : filter === 'completed' ? (
          <EmptyState icon="sparkles" title="No completed tasks yet">
            Finished tasks will collect here. Check one off to see your progress grow.
          </EmptyState>
        ) : filter === 'active' && counts.all > 0 ? (
          <EmptyState icon="circleCheck" title="All clear">
            You’ve completed everything on your list. Nicely done.
          </EmptyState>
        ) : (
          <EmptyState icon="inbox" title="No tasks yet">
            Add your first task above. Try something small you can finish in one focus session.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
