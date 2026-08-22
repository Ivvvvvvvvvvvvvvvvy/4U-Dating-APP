import { useCallback, useEffect, useRef, useState } from 'react';

const parseSet = (key: string) => {
  try { return new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]') as string[]); }
  catch { return new Set<string>(); }
};

export function usePersistentSet(key: string) {
  const [values, setValues] = useState<Set<string>>(() => parseSet(key));
  useEffect(() => localStorage.setItem(key, JSON.stringify([...values])), [key, values]);
  const toggle = useCallback((value: string) => setValues((current) => {
    const next = new Set(current);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  }), []);
  return { values, setValues, toggle };
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); };
  }, []);
  return online;
}

export function useScrollMemory(routeKey: string, enabled: boolean, restoreOverride?: number) {
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    lastKey.current = routeKey;
    const saved = restoreOverride ?? Number(sessionStorage.getItem('4u:scroll:' + routeKey) ?? 0);
    const target = Number.isFinite(saved) ? saved : 0;
    let restoring = true;
    const restore = () => window.scrollTo(0, target);
    requestAnimationFrame(() => { restore(); requestAnimationFrame(restore); });
    const settleTimers = [220, 500, 900].map((delay, index, values) => window.setTimeout(() => { restore(); if (index === values.length - 1) restoring = false; }, delay));
    const onScroll = () => { if (!restoring) sessionStorage.setItem('4u:scroll:' + routeKey, String(window.scrollY)); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { settleTimers.forEach((timer) => window.clearTimeout(timer)); sessionStorage.setItem('4u:scroll:' + routeKey, String(window.scrollY)); window.removeEventListener('scroll', onScroll); };
  }, [enabled, restoreOverride, routeKey]);
}

export function useTransientMessage() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [message]);
  return [message, setMessage] as const;
}
