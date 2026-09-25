import type { ReactNode } from 'react';

interface Props {
  title: string;
  icon?: string;
  loading?: boolean;
  children?: ReactNode;
}

export function FullscreenMessage({ title, icon, loading, children }: Props) {
  return (
    <div className="fullscreen-message wa-stack wa-align-items-center wa-gap-m" role={loading ? 'status' : undefined}>
      {loading ? <wa-spinner className="fullscreen-spinner" aria-label="Wird geladen"></wa-spinner> : null}
      {icon ? <wa-icon name={icon} className="fullscreen-icon"></wa-icon> : null}
      <h1 className="wa-heading-l">{title}</h1>
      {children ? <p className="wa-body-m wa-color-text-quiet">{children}</p> : null}
    </div>
  );
}
