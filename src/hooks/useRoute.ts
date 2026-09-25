import { useEffect, useState } from 'react';

export const ROUTES = ['lernen', 'vokabeln', 'neu', 'statistik', 'einstellungen'] as const;
export type Route = (typeof ROUTES)[number];

/**
 * Minimal hash router ("#/vokabeln"). Hash routing works on GitHub Pages
 * without a 404 fallback. Auth redirects ("#access_token=...") don't start
 * with "#/" and are consumed by Supabase, so they never collide.
 */
function parse(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'lernen';
}

export function href(route: Route): string {
  return `#/${route}`;
}

export function navigate(route: Route): void {
  window.location.hash = `/${route}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
