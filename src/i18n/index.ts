import { zhCN } from './zh-CN';
import { en } from './en';
import type { I18nKey, I18nParams, Locale } from './types';

export type { I18nKey, I18nParams, Locale } from './types';

type Listener = (locale: Locale) => void;

const tables: Record<Locale, Partial<Record<I18nKey, string>>> = { 'zh-CN': zhCN, en };
let current: Locale = 'zh-CN';
const listeners = new Set<Listener>();

export function getLocale(): Locale {
  return current;
}

export function isLocale(v: unknown): v is Locale {
  return v === 'zh-CN' || v === 'en';
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  for (const l of [...listeners]) l(locale);
}

/** Subscribe to locale changes; returns an unsubscribe function. */
export function onLocaleChanged(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function interpolate(s: string, params?: I18nParams): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** Translate a key; falls back to zh-CN, then to the key itself. */
export function t(key: I18nKey, params?: I18nParams): string {
  const s = tables[current][key] ?? zhCN[key] ?? key;
  return interpolate(s, params);
}

/** For dynamic keys built at runtime (e.g. `weapon.${id}.name`); returns the key when unknown. */
export function tDynamic(key: string, params?: I18nParams): string {
  return t(key as I18nKey, params);
}

export function hasKey(key: string): key is I18nKey {
  return Object.prototype.hasOwnProperty.call(zhCN, key);
}

export function allKeys(): I18nKey[] {
  return Object.keys(zhCN) as I18nKey[];
}

/** mm:ss for the HUD and results. */
export function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}
