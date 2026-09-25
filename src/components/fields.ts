import type { FormEvent } from 'react';

/** Value of a Web Awesome form control from an input event. */
export function valueOf(event: Event | FormEvent): string {
  return String((event.target as HTMLElement & { value?: unknown }).value ?? '');
}

export const MIN_PASSWORD_LENGTH = 8;

/** Focuses a Web Awesome element once it has rendered (focus() before that throws). */
export function focusWhenReady(el: { focus: () => void } | null | undefined): void {
  if (!el) return;
  const ready = (el as { updateComplete?: Promise<unknown> }).updateComplete;
  void Promise.resolve(ready).then(() => {
    try {
      el.focus();
    } catch {
      // element was removed in the meantime
    }
  });
}
