import type { Route } from '../hooks/useRoute';
import { useNow } from '../hooks/useNow';
import { formatClock, getElapsedFraction, getRemainingMs } from '../lib/time';
import { getActiveTimer, isActiveStatus, titleForKey, useOrbit } from '../state/OrbitContext';
import { useUi } from '../state/UiContext';
import { Icon, Logo, type IconName } from './Icon';

const NAV: { route: Route; label: string; short: string; icon: IconName }[] = [
  { route: 'today', label: 'Overview', short: 'Overview', icon: 'home' },
  { route: 'tasks', label: 'My Tasks', short: 'Tasks', icon: 'tasks' },
  { route: 'focus', label: 'Focus', short: 'Focus', icon: 'timer' },
];

function useActiveTaskCount() {
  const { state } = useOrbit();
  return state.tasks.filter((t) => !t.completed).length;
}

/** Small live indicator of a running or paused session, visible from every section. */
export function SessionPill({ variant }: { variant: 'sidebar' | 'mobile' }) {
  const { state } = useOrbit();
  const { navigate, route } = useUi();
  // Always reflects the currently selected timer (a task's own timer, or free focus).
  const timer = getActiveTimer(state);
  const taskTitle = titleForKey(state, state.activeKey);
  const now = useNow(250, timer.status === 'running');

  if (!isActiveStatus(timer) || (variant === 'mobile' && route === 'focus')) return null;
  const remaining = getRemainingMs(timer, now);
  const progress = getElapsedFraction(timer, now);
  const paused = timer.status === 'paused';

  return (
    <button
      type="button"
      className={`session-pill session-pill--${variant} ${paused ? 'is-paused' : ''}`}
      onClick={() => navigate('focus')}
      aria-label={`${paused ? 'Paused' : 'Focusing'} on ${taskTitle ?? 'free focus'}: ${formatClock(remaining)} remaining. Open focus mode.`}
    >
      <span className="session-pill__ring" style={{ ['--p' as string]: progress }} aria-hidden="true" />
      <span className="session-pill__body">
        <span className="session-pill__label">{paused ? 'Paused' : 'Focusing'}</span>
        <span className="session-pill__task">{taskTitle ?? 'Free focus'}</span>
      </span>
      <span className="session-pill__time">{formatClock(remaining)}</span>
    </button>
  );
}

export function Sidebar() {
  const { route, navigate } = useUi();
  const activeCount = useActiveTaskCount();

  return (
    <aside className="sidebar" aria-label="Main">
      <div className="brand">
        <Logo />
        <div>
          <div className="brand__name">Orbit</div>
          <div className="brand__tag">Your focus space</div>
        </div>
      </div>

      <nav className="nav">
        {NAV.map((item) => (
          <a
            key={item.route}
            href={`#/${item.route}`}
            className={`nav__item ${route === item.route ? 'is-active' : ''}`}
            aria-current={route === item.route ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate(item.route);
            }}
          >
            <Icon name={item.icon} size={18} />
            <span>{item.label}</span>
            {item.route === 'tasks' && activeCount > 0 && (
              <span className="nav__count" aria-label={`${activeCount} open`}>
                {activeCount}
              </span>
            )}
          </a>
        ))}
      </nav>

      <div className="sidebar__bottom">
        <SessionPill variant="sidebar" />
        <div className="flow-hint" aria-hidden="true">
          <span>Plan</span>
          <Icon name="chevronRight" size={12} />
          <span>Focus</span>
          <Icon name="chevronRight" size={12} />
          <span>Celebrate</span>
        </div>
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  return (
    <header className="topbar">
      <div className="brand brand--small">
        <Logo size={26} />
        <span className="brand__name">Orbit</span>
      </div>
    </header>
  );
}

export function MobileTabBar() {
  const { route, navigate } = useUi();
  const activeCount = useActiveTaskCount();

  return (
    <nav className="tabbar" aria-label="Main">
      <SessionPill variant="mobile" />
      <div className="tabbar__items">
        {NAV.map((item) => (
          <a
            key={item.route}
            href={`#/${item.route}`}
            className={`tabbar__item ${route === item.route ? 'is-active' : ''}`}
            aria-current={route === item.route ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              navigate(item.route);
            }}
          >
            <span className="tabbar__icon">
              <Icon name={item.icon} size={20} />
              {item.route === 'tasks' && activeCount > 0 && <span className="tabbar__dot" aria-hidden="true" />}
            </span>
            <span>{item.short}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
