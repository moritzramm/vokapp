import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * <wa-dialog> driven by React state. Nested components (e.g. <wa-select>)
 * emit their own bubbling wa-after-hide events, so only the dialog's own
 * event closes it.
 */
export function Dialog({ open, label, onClose, children, footer }: Props) {
  return (
    <wa-dialog
      open={open}
      label={label}
      className="app-dialog"
      onwa-after-hide={(event: Event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
      {footer ? (
        <div slot="footer" className="dialog-footer">
          {footer}
        </div>
      ) : null}
    </wa-dialog>
  );
}
