/** Thin wrapper around the single <wa-toast> rendered by the app shell. */
type Variant = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

const ICONS: Record<Variant, string> = {
  brand: 'circle-check',
  success: 'circle-check',
  warning: 'triangle-exclamation',
  danger: 'circle-xmark',
  neutral: 'circle-check',
};

export function notify(message: string, variant: Variant = 'success'): void {
  const toast = document.querySelector('wa-toast') as (HTMLElement & { create?: (m: string, o: object) => unknown }) | null;
  if (toast?.create) toast.create(message, { variant, icon: ICONS[variant], duration: variant === 'danger' ? 8000 : 5000 });
}
