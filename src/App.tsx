import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { MobileTabBar, MobileTopBar, Sidebar } from './components/Navigation';
import { useNow } from './hooks/useNow';
import { useRoute } from './hooks/useRoute';
import { formatClock, getRemainingMs } from './lib/time';
import { Focus } from './pages/Focus';
import { Tasks } from './pages/Tasks';
import { Today } from './pages/Today';
import { getActiveTimer, useOrbit } from './state/OrbitContext';
import { UiContext, type ToastOptions } from './state/UiContext';

interface Toast extends ToastOptions {
  id: number;
}

export default function App() {
  const { state } = useOrbit();
  const [route, navigate] = useRoute();
  const [toast, setToast] = useState<Toast | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const toastTimer = useRef<number>();

  const showToast = useCallback((t: ToastOptions) => {
    window.clearTimeout(toastTimer.current);
    setToast({ ...t, id: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), t.onAction ? 7000 : 4000);
  }, []);

  const ui = useMemo(() => ({ route, navigate, showToast }), [route, navigate, showToast]);

  // Move focus to the new page heading on navigation (not on first load).
  const prevRoute = useRef(route);
  useEffect(() => {
    if (prevRoute.current === route) return;
    prevRoute.current = route;
    window.scrollTo({ top: 0 });
    document.getElementById('page-title')?.focus({ preventScroll: true });
  }, [route]);

  // Announce timer state changes for screen readers, and celebrate completion from any section.
  const timer = getActiveTimer(state);
  const activeKey = state.activeKey;
  const prev = useRef({ key: activeKey, status: timer.status });
  useEffect(() => {
    const before = prev.current;
    prev.current = { key: activeKey, status: timer.status };
    // Switching to another task's timer isn't a state change of that timer.
    if (before.key !== activeKey || before.status === timer.status) return;
    if (timer.status === 'running') setAnnouncement(before.status === 'paused' ? 'Focus session resumed' : 'Focus session started');
    else if (timer.status === 'paused') setAnnouncement('Focus session paused');
    else if (timer.status === 'idle' && (before.status === 'running' || before.status === 'paused')) {
      setAnnouncement('Timer reset. The session was not recorded.');
    }
  }, [activeKey, timer.status]);

  // Celebrate each newly recorded session once, from whichever section is open.
  const sessionCount = state.sessions.length;
  const prevSessionCount = useRef(sessionCount);
  useEffect(() => {
    const before = prevSessionCount.current;
    prevSessionCount.current = sessionCount;
    if (sessionCount <= before) return;
    const latest = state.sessions[sessionCount - 1];
    setAnnouncement(`Focus session complete. ${latest.minutes} minutes added to today.`);
    if (route !== 'focus') {
      showToast({
        message: `Session complete · +${latest.minutes} min`,
        tone: 'success',
        actionLabel: 'View',
        onAction: () => navigate('focus'),
      });
    }
  }, [sessionCount, state.sessions, route, navigate, showToast]);

  // Live countdown in the browser tab title.
  const now = useNow(1000, timer.status === 'running');
  useEffect(() => {
    if (timer.status === 'running') document.title = `${formatClock(getRemainingMs(timer, now))} · Focusing — Orbit`;
    else if (timer.status === 'paused') document.title = `Paused · ${formatClock(timer.remainingMs)} — Orbit`;
    else if (timer.status === 'completed') document.title = 'Session complete — Orbit';
    else document.title = 'Orbit — Your Personal Focus Space';
  }, [timer, now]);

  return (
    <UiContext.Provider value={ui}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="app">
        <Sidebar />
        <div className="app__main">
          <MobileTopBar />
          <main id="main" className="main" key={route}>
            {route === 'today' && <Today />}
            {route === 'tasks' && <Tasks />}
            {route === 'focus' && <Focus />}
          </main>
        </div>
        <MobileTabBar />
      </div>

      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>

      <div className="toast-region" aria-live="polite">
        {toast && (
          <div key={toast.id} className={`toast ${toast.tone === 'success' ? 'toast--success' : ''}`} role="status">
            {toast.tone === 'success' && <Icon name="circleCheck" size={18} />}
            <span className="toast__msg">{toast.message}</span>
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
            <button type="button" className="toast__close" onClick={() => setToast(null)} aria-label="Dismiss notification">
              <Icon name="x" size={14} />
            </button>
          </div>
        )}
      </div>
    </UiContext.Provider>
  );
}
