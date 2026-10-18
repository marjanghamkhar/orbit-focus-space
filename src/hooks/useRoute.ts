import { useCallback, useEffect, useState } from 'react';

export type Route = 'today' | 'tasks' | 'focus';
const ROUTES: Route[] = ['today', 'tasks', 'focus'];

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES as string[]).includes(h) ? (h as Route) : 'today';
}

/** Tiny hash router, so the browser back button and refresh keep the current section. */
export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parseHash);

  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((r: Route) => {
    if (parseHash() !== r || !window.location.hash) window.location.hash = `/${r}`;
  }, []);

  return [route, navigate];
}
