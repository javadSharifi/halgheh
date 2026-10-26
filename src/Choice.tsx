import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

/** A button that opens a glass bottom sheet to pick one option (replaces the native <select> popup). */
export function Choice<T extends string | number>({ label, value, options, onChange, disabled, className, children }: {
  label: string; value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean; className?: string; children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pick = (v: T) => { onChange(v); setOpen(false); };
  return (
    <>
      <button type="button" className={className} aria-label={label} aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}>
        {children ?? options.find(([v]) => v === value)?.[1]}
      </button>
      {open && createPortal(
        <>
          <div className="scrim dim" onClick={() => setOpen(false)} />
          <div className="glass sheet" role="dialog" aria-label={label}>
            <b className="sheet-title">{label}</b>
            <div className="pick-list" role="radiogroup" aria-label={label}>
              {options.map(([v, n]) => (
                <button key={v} role="radio" aria-checked={v === value} className={`pick-opt${v === value ? ' on' : ''}`} onClick={() => pick(v)}>
                  {n}{v === value && <Icon name="check" size={18} stroke={2.4} />}
                </button>
              ))}
            </div>
            <div className="sheet-actions"><button onClick={() => setOpen(false)}>بستن</button></div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
