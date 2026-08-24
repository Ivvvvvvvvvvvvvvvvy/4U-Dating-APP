import { useCallback, useEffect, useMemo, useState } from 'react';
import { randomId } from './randomId';

export type HomePrimary = 'recommend' | 'activities' | 'topics';
export type HomeSecondary =
  | 'for-you' | 'nearby' | 'weekend' | 'new'
  | 'all' | 'duo' | 'group' | 'exhibition' | 'movie' | 'sport'
  | 'hot' | 'relationship' | 'lifestyle' | 'expression';
export type DiscoverSegment = 'for-you' | 'nearby' | 'new' | 'serious';
export type MessageCategory = 'matches' | 'activities' | 'notifications';
export type OnboardingStep = 'welcome' | 'account' | 'adult-check' | 'identity' | 'preferences' | 'mbti' | 'interests' | 'photos' | 'expression' | 'ai-review' | 'privacy-preview' | 'status' | 'revise';

export type AppRoute =
  | { kind: 'entry' }
  | { kind: 'login' }
  | { kind: 'admin' }
  | { kind: 'home'; primary: HomePrimary; secondary: HomeSecondary }
  | { kind: 'discover'; segment: DiscoverSegment }
  | { kind: 'messages'; category: MessageCategory }
  | { kind: 'chat'; roomType: 'match' | 'activity' | 'discussion'; roomId: string }
  | { kind: 'me'; section: string }
  | { kind: 'activity'; id: string }
  | { kind: 'person'; id: string }
  | { kind: 'topic'; id: string }
  | { kind: 'create'; draftId: string; step: 1 | 2 }
  | { kind: 'onboarding'; step: OnboardingStep }
  | { kind: 'search'; query: string };

export type BrowserLocation = {
  pathname: string;
  search: string;
  state: Record<string, unknown>;
  key: string;
};

const useHashRouting = import.meta.env.PROD && import.meta.env.BASE_URL !== '/';

const readHashLocation = () => {
  const raw = window.location.hash.slice(1) || '/';
  const url = new URL(raw.startsWith('/') ? raw : '/' + raw, window.location.origin);
  return { pathname: url.pathname, search: url.search };
};

const secondaryByPrimary: Record<HomePrimary, readonly HomeSecondary[]> = {
  recommend: ['for-you', 'nearby', 'weekend', 'new'],
  activities: ['all', 'weekend', 'duo', 'group', 'exhibition', 'movie', 'sport'],
  topics: ['hot', 'relationship', 'lifestyle', 'expression'],
};

const defaults: Record<HomePrimary, HomeSecondary> = {
  recommend: 'for-you',
  activities: 'all',
  topics: 'hot',
};

const locationSnapshot = (): BrowserLocation => {
  const state = (window.history.state ?? {}) as Record<string, unknown>;
  const routeLocation = useHashRouting
    ? readHashLocation()
    : { pathname: window.location.pathname, search: window.location.search };
  return {
    pathname: routeLocation.pathname,
    search: routeLocation.search,
    state,
    key: typeof state.__key === 'string' ? state.__key : 'initial',
  };
};

const isOneOf = <T extends string>(value: string | null, values: readonly T[]): value is T =>
  Boolean(value && values.includes(value as T));

export function parseRoute(pathname: string, search = ''): AppRoute {
  const params = new URLSearchParams(search);
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (!segments.length) return { kind: 'entry' };

  if (segments[0] === 'login') return { kind: 'login' };

  if (segments[0] === 'admin') return { kind: 'admin' };

  if (segments[0] === 'home') {
    const rawPrimary = params.get('primary');
    const primary: HomePrimary = isOneOf(rawPrimary, ['recommend', 'activities', 'topics']) ? rawPrimary : 'recommend';
    const rawSecondary = params.get('secondary');
    const secondary = isOneOf(rawSecondary, secondaryByPrimary[primary]) ? rawSecondary : defaults[primary];
    return { kind: 'home', primary, secondary };
  }

  if (segments[0] === 'discover') {
    const raw = params.get('segment');
    return { kind: 'discover', segment: isOneOf(raw, ['for-you', 'nearby', 'new', 'serious']) ? raw : 'for-you' };
  }

  if (segments[0] === 'messages' && segments.length >= 3) {
    const roomType = isOneOf(segments[1], ['match', 'activity', 'discussion']) ? segments[1] : 'match';
    return { kind: 'chat', roomType, roomId: segments[2] };
  }

  if (segments[0] === 'messages') {
    const raw = params.get('category');
    return { kind: 'messages', category: isOneOf(raw, ['matches', 'activities', 'notifications']) ? raw : 'matches' };
  }

  if (segments[0] === 'me') return { kind: 'me', section: segments[1] ?? 'profile' };
  if (segments[0] === 'onboarding') {
    const step = isOneOf(segments[1] ?? null, ['welcome', 'account', 'adult-check', 'identity', 'preferences', 'mbti', 'interests', 'photos', 'expression', 'ai-review', 'privacy-preview', 'status', 'revise']) ? segments[1] as OnboardingStep : 'welcome';
    return { kind: 'onboarding', step };
  }
  if (segments[0] === 'activities' && segments[1] === 'new') {
    const parsedStep = Number(segments[3]);
    return { kind: 'create', draftId: segments[2] ?? 'local-draft', step: parsedStep === 2 ? 2 : 1 };
  }
  if (segments[0] === 'activities' && segments[1]) return { kind: 'activity', id: segments[1] };
  if (segments[0] === 'people' && segments[1]) return { kind: 'person', id: segments[1] };
  if (segments[0] === 'topics' && segments[1]) return { kind: 'topic', id: segments[1] };
  if (segments[0] === 'search') return { kind: 'search', query: params.get('q') ?? '' };

  return { kind: 'home', primary: 'recommend', secondary: 'for-you' };
}

export function canonicalPath(route: AppRoute): string {
  switch (route.kind) {
    case 'entry': return '/';
    case 'login': return '/login';
    case 'admin': return '/admin';
    case 'home': return '/home?primary=' + route.primary + '&secondary=' + route.secondary;
    case 'discover': return '/discover?segment=' + route.segment;
    case 'messages': return '/messages?category=' + route.category;
    case 'chat': return '/messages/' + route.roomType + '/' + encodeURIComponent(route.roomId);
    case 'me': return '/me/' + encodeURIComponent(route.section);
    case 'activity': return '/activities/' + encodeURIComponent(route.id);
    case 'person': return '/people/' + encodeURIComponent(route.id);
    case 'topic': return '/topics/' + encodeURIComponent(route.id);
    case 'create': return '/activities/new/' + encodeURIComponent(route.draftId) + '/' + route.step;
    case 'onboarding': return '/onboarding/' + route.step;
    case 'search': return '/search' + (route.query ? '?q=' + encodeURIComponent(route.query) : '');
  }
}

export function routeTab(route: AppRoute): 'home' | 'discover' | 'messages' | 'me' {
  if (route.kind === 'discover' || route.kind === 'person') return 'discover';
  if (route.kind === 'messages' || route.kind === 'chat') return 'messages';
  if (route.kind === 'me' || route.kind === 'admin') return 'me';
  return 'home';
}

export function useBrowserRouter() {
  const [location, setLocation] = useState<BrowserLocation>(() => locationSnapshot());

  useEffect(() => {
    window.history.scrollRestoration = 'manual';
    if (!window.history.state?.__key) {
      window.history.replaceState({ ...(window.history.state ?? {}), __key: randomId() }, '', window.location.href);
      setLocation(locationSnapshot());
    }
    const onPopState = () => setLocation(locationSnapshot());
    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onPopState);
    };
  }, []);

  const navigate = useCallback((to: string, options?: { replace?: boolean; state?: Record<string, unknown> }) => {
    const state = { ...(options?.state ?? {}), __key: randomId() };
    const target = useHashRouting ? import.meta.env.BASE_URL + '#' + to : to;
    if (options?.replace) window.history.replaceState(state, '', target);
    else window.history.pushState(state, '', target);
    setLocation(locationSnapshot());
  }, []);

  const route = useMemo(() => parseRoute(location.pathname, location.search), [location.pathname, location.search]);
  return { location, route, navigate };
}

export function sanitizeRoute(route: AppRoute): AppRoute {
  if (route.kind === 'home') {
    const secondary = secondaryByPrimary[route.primary].includes(route.secondary) ? route.secondary : defaults[route.primary];
    return { ...route, secondary };
  }
  return route;
}

export const homeSecondaries = secondaryByPrimary;
export const homeDefaults = defaults;
