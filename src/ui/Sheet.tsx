import { type ReactNode, useEffect, useRef } from 'react';
import { Icon } from '../Icon';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

// Stack of active sheet close handlers to ensure only the topmost sheet responds to Escape
const activeSheets: Array<() => void> = [];
let openSheetCount = 0;
let previousBodyOverflow = '';

function pushSheet(onClose: () => void) {
  if (openSheetCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  openSheetCount++;
  activeSheets.push(onClose);
}

function popSheet(onClose: () => void) {
  const index = activeSheets.lastIndexOf(onClose);
  if (index !== -1) {
    activeSheets.splice(index, 1);
  }
  openSheetCount = Math.max(0, openSheetCount - 1);
  if (openSheetCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    e => {
      if (e.key === 'Escape' && activeSheets.length > 0) {
        const topClose = activeSheets[activeSheets.length - 1];
        topClose();
      }
    },
    true, // capture phase
  );
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className = '',
}: SheetProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const handler = () => onCloseRef.current();
    pushSheet(handler);
    return () => popSheet(handler);
  }, [open]);

  if (!open) return null;

  return (
    <div className="ui-sheet-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`ui-sheet-content ${className}`.trim()}
        onClick={e => e.stopPropagation()}
      >
        <div className="ui-sheet-handle" aria-hidden="true" />

        {(title || subtitle) && (
          <div className="ui-sheet-header">
            <div className="ui-sheet-titles">
              {title && <h2 className="ui-sheet-title">{title}</h2>}
              {subtitle && <p className="ui-sheet-subtitle">{subtitle}</p>}
            </div>
            <button
              type="button"
              className="ui-sheet-close"
              onClick={onClose}
              aria-label="بستن"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
        )}

        <div className="ui-sheet-body">{children}</div>

        {footer && <div className="ui-sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}
