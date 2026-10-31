import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, put, uid } from './db';
import { Button, InputField } from './ui';
import { tx } from './i18n';

const MAX_NAME = 80; // a name the row and sync can carry without truncation; the schema has no hard limit
const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim().toLocaleLowerCase('fa');

export function QuickAdd({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];

  const displayName = name.replace(/\s+/g, ' ').trim();
  // two rows with the same name are allowed (people can share a name); this only warns, it never blocks
  const twin = displayName ? people.find((p) => !p.isSelf && !p.archivedAt && squeeze(p.displayName) === squeeze(displayName)) : undefined;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayName || busy) return;
    setBusy(true);
    setError('');
    try {
      const now = Date.now();
      await put('people', { id: uid(), displayName, phones: [], emails: [], createdAt: now, updatedAt: now });
      onSaved();
    } catch {
      setError(tx('ثبت نشد؛ دوباره تلاش کن.'));
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet quick-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-add-title">
        <div className="bf-head">
          <span id="quick-add-title">{tx('افزودن سریع')}</span>
          <Button variant="ghost" size="sm" onClick={onClose}>{tx('بستن')}</Button>
        </div>
        <form className="quick-form" onSubmit={save}>
          <InputField
            autoFocus
            label={tx('نام')}
            value={name}
            maxLength={MAX_NAME}
            onChange={(e) => setName(e.target.value)}
            placeholder={tx('مثلاً سارا احمدی')}
            enterKeyHint="done"
            aria-describedby={twin ? 'quick-twin' : undefined}
          />
          <p className="hint quick-hint">{tx('فقط یک نام لازم است؛ بقیهٔ اطلاعات بعداً اضافه می‌شود.')}</p>
          {twin && (
            <p id="quick-twin" className="hint quick-hint" role="status">
              «{twin.displayName}{tx('» از قبل در فهرست هست. اگر این آدم دیگری است، ثبتش کن.')}</p>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button variant="primary" block type="submit" disabled={busy || !displayName} icon="check">
            {busy ? tx('در حال ثبت…') : tx('ثبت فرد')}
          </Button>
        </form>
      </section>
    </>
  );
}
