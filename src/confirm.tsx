import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';

type Options = {
  title: string;
  message?: string;
  confirm: string; // label of the button that goes ahead
  cancel?: string;
  icon?: IconName;
  tone?: 'danger' | 'default';
};
type Pending = Options & { resolve: (ok: boolean) => void };

let host: ((p: Pending) => void) | null = null;

/** Asks the user to confirm. Resolves true to go ahead, false to back out. Used instead of window.confirm. */
export function ask(options: Options): Promise<boolean> {
  return new Promise((resolve) => {
    if (host) host({ ...options, resolve });
    else resolve(window.confirm(options.title)); // before the host is mounted: fall back to the browser's own
  });
}

/** Mount once near the root: it shows the dialog for whatever `ask` was last called with. */
export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    host = setPending;
    return () => {
      host = null;
    };
  }, []);

  useEffect(() => {
    if (pending) cancelRef.current?.focus(); // the safe choice is the one under the thumb
  }, [pending]);

  if (!pending) return null;
  const done = (ok: boolean) => {
    pending.resolve(ok);
    setPending(null);
  };
  const danger = (pending.tone ?? 'danger') === 'danger';

  return (
    <>
      <div className="scrim dim confirm-scrim" onClick={() => done(false)} />
      <div
        className="glass confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={pending.message ? 'confirm-text' : undefined}
        onKeyDown={(e) => e.key === 'Escape' && done(false)}
      >
        <span className={`confirm-icon${danger ? ' danger' : ''}`} aria-hidden="true">
          <Icon name={pending.icon ?? (danger ? 'trash' : 'info')} size={24} stroke={1.9} />
        </span>
        <b id="confirm-title">{pending.title}</b>
        {pending.message && <p id="confirm-text">{pending.message}</p>}
        <div className="confirm-actions">
          <button ref={cancelRef} onClick={() => done(false)}>{pending.cancel ?? 'انصراف'}</button>
          <button className={danger ? 'danger-fill' : 'primary'} onClick={() => done(true)}>{pending.confirm}</button>
        </div>
      </div>
    </>
  );
}
