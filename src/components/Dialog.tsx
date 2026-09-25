import type { ReactNode } from 'react';
import { useMediaQuery } from '../hooks/useOnline';

interface Props {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Bottom sheet (<wa-drawer placement="bottom">) on phones, centred <wa-dialog>
 * on larger screens. Driven by React state; footer buttons close it by
 * setting `open` to false. Nested components (e.g. <wa-select>) emit their
 * own bubbling wa-after-hide events, so only the container's own event counts.
 */
export function Dialog({ open, label, onClose, children, footer }: Props) {
  const sheet = useMediaQuery('(max-width: 767px)');
  const onAfterHide = (event: Event) => {
    if (event.target === event.currentTarget) onClose();
  };
  const footerNode = footer ? (
    <div slot="footer" className="dialog-footer">
      {footer}
    </div>
  ) : null;

  return sheet ? (
    <wa-drawer open={open} label={label} placement="bottom" className="app-sheet" onwa-after-hide={onAfterHide}>
      {children}
      {footerNode}
    </wa-drawer>
  ) : (
    <wa-dialog open={open} label={label} className="app-dialog" onwa-after-hide={onAfterHide}>
      {children}
      {footerNode}
    </wa-dialog>
  );
}
