// Route + scenario state, serialized in the URL hash so a presenter can send a link
// to an exact configuration:  #/nci/cluster?nodes=8&npb=2&ba=1
//
// Navigation between modules pushes history (so the browser Back button works);
// tweaking a control replaces the current entry (so history isn't spammed).
import { useEffect, useState } from 'preact/hooks';

export interface Route {
  path: string; // e.g. "nci/cluster" ("" = landing)
  params: Record<string, string>;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [p, q = ''] = raw.split('?');
  const params: Record<string, string> = {};
  for (const part of q.split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    try {
      params[decodeURIComponent(k)] = decodeURIComponent(v);
    } catch {
      /* ignore malformed pair */
    }
  }
  return { path: p.replace(/\/+$/, ''), params };
}

export function buildHash(path: string, params: Record<string, string> = {}): string {
  const q = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  return `#/${path}${q ? `?${q}` : ''}`;
}

let current: Route = typeof location !== 'undefined' ? parseHash(location.hash) : { path: '', params: {} };

function emit() {
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    current = parseHash(location.hash);
    emit();
  });
}

export function getRoute(): Route {
  return current;
}

/** Go to a module. Pushes a history entry. */
export function navigate(path: string, params: Record<string, string> = {}) {
  const next = buildHash(path, params);
  if (location.hash === next) return;
  current = { path, params };
  location.hash = next; // triggers hashchange -> emit (idempotent)
  emit();
}

/** Patch scenario params on the current route without adding history. null/undefined removes a key. */
export function setParams(patch: Record<string, string | number | boolean | null | undefined>) {
  const params = { ...current.params };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === '') delete params[k];
    else params[k] = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
  }
  current = { path: current.path, params };
  history.replaceState(null, '', buildHash(current.path, params));
  emit();
}

export function replaceParams(params: Record<string, string>) {
  current = { path: current.path, params: { ...params } };
  history.replaceState(null, '', buildHash(current.path, current.params));
  emit();
}

export function useRoute(): Route {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return current;
}

// ── typed param hooks: the default value is never written to the URL ──

export function useNum(key: string, def: number, min = -Infinity, max = Infinity): [number, (v: number) => void] {
  const r = useRoute();
  const raw = r.params[key];
  let v = raw === undefined ? def : Number(raw);
  if (!Number.isFinite(v)) v = def;
  v = Math.min(max, Math.max(min, v));
  return [v, (n: number) => setParams({ [key]: n === def ? null : n })];
}

export function useBool(key: string, def: boolean): [boolean, (v: boolean) => void] {
  const r = useRoute();
  const raw = r.params[key];
  const v = raw === undefined ? def : raw === '1' || raw === 'true';
  return [v, (b: boolean) => setParams({ [key]: b === def ? null : b })];
}

export function useEnum<T extends string>(key: string, def: T, allowed: readonly T[]): [T, (v: T) => void] {
  const r = useRoute();
  const raw = r.params[key] as T | undefined;
  const v = raw !== undefined && allowed.includes(raw) ? raw : def;
  return [v, (s: T) => setParams({ [key]: s === def ? null : s })];
}

export function useStr(key: string, def: string): [string, (v: string) => void] {
  const r = useRoute();
  const v = r.params[key] ?? def;
  return [v, (s: string) => setParams({ [key]: s === def ? null : s })];
}
