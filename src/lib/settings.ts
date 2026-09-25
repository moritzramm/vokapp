/** Per-device UI settings. Only non-essential preferences live in localStorage. */

export type ThemeChoice = 'light' | 'dark' | 'system';

const PREFIX = 'vokabel-app:';

export function readSetting<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeSetting<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore (private mode, storage full)
  }
}

export const SESSION_SIZES = [10, 20, 50, 0] as const; // 0 = alle
export type SessionSize = (typeof SESSION_SIZES)[number];

export function applyTheme(choice: ThemeChoice): void {
  const dark = choice === 'dark' || (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  root.classList.toggle('wa-dark', dark);
  root.classList.toggle('wa-light', !dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#16181d' : '#ffffff');
}
