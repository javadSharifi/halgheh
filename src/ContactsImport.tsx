import { useEffect, useMemo, useState } from 'react';
import { Contacts } from '@capacitor-community/contacts';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Person, db } from './db';
import { fa } from './cal';
import { normalize } from './search';
import { importPicks, markDuplicates, permissionText, toPicks, type Pick } from './contacts';
import { Icon } from './Icon';
import { tn, tx } from './i18n';

type Phase = 'idle' | 'asking' | 'loading' | 'ready' | 'denied' | 'error' | 'saving' | 'done';

const PROJECTION = { name: true, phones: true, emails: true, organization: true } as const;
const limited = 400; // contacts shown at once; the list stays scannable and the DOM stays cheap

/**
 * Import people from the phone's address book (P4). The permission is requested only when the sheet opens, which only
 * happens after the user pressed "افزودن از مخاطبین"; nothing here runs at start-up.
 */
export function ContactsImport({ onClose, onImported }: { onClose: () => void; onImported?: (n: number) => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [picks, setPicks] = useState<Pick[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const duplicates = useMemo(() => markDuplicates(picks, people), [picks, people]);

  const load = async () => {
    setNote('');
    setPhase('asking');
    try {
      const perm = await Contacts.requestPermissions();
      if (perm.contacts !== 'granted' && perm.contacts !== 'limited') {
        setPhase('denied');
        setNote(permissionText(perm.contacts));
        return;
      }
      setPhase('loading');
      const { contacts } = await Contacts.getContacts({ projection: PROJECTION });
      const all = toPicks(contacts);
      setPicks(all);
      // duplicates start unselected: the notebook row already exists and importing it again is usually a mistake
      setChosen(new Set(all.filter((p) => !markDuplicates([p], people)[0].existing).map((p) => p.contactId)));
      setPhase('ready');
    } catch {
      setPhase('error');
      setNote(tx('خواندن مخاطبین ممکن نشد. افزودن دستی همچنان کار می‌کند.'));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const query = normalize(q).n.trim();
  const visible = useMemo(() => {
    if (!query) return duplicates;
    return duplicates.filter((p) => normalize([p.displayName, ...p.phones, ...p.emails].join(' ')).n.includes(query));
  }, [duplicates, query]);

  const shown = visible.slice(0, limited);
  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allShownChosen = shown.length > 0 && shown.every((p) => chosen.has(p.contactId));
  const toggleAll = () =>
    setChosen((prev) => {
      const next = new Set(prev);
      for (const p of shown) {
        if (allShownChosen) next.delete(p.contactId);
        else next.add(p.contactId);
      }
      return next;
    });

  const save = async () => {
    const picked = duplicates.filter((p) => chosen.has(p.contactId));
    if (picked.length === 0) return;
    setPhase('saving');
    try {
      const r = await importPicks(picked, people);
      setPhase('done');
      setNote(
        [r.added ? tx('{a1} نفر اضافه شد', { a1: fa(r.added) }) : '', r.merged ? tx('{a1} نفر تکمیل شد', { a1: fa(r.merged) }) : '', r.skipped ? tx('{a1} نفر از قبل بود', { a1: fa(r.skipped) }) : '']
          .filter(Boolean)
          .join(' · '),
      );
      onImported?.(r.added + r.merged);
    } catch {
      setPhase('error');
      setNote(tx('ذخیره نشد؛ دوباره تلاش کن.'));
    }
  };

  const dupCount = duplicates.filter((p) => p.existing).length;
  const total = duplicates.length;

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet contacts-sheet" role="dialog" aria-modal="true" aria-labelledby="contacts-title">
        <div className="bf-head">
          <span id="contacts-title">{tx('افزودن از مخاطبین')}</span>
          <button className="text-btn" onClick={onClose}>{tx('بستن')}</button>
        </div>

        {(phase === 'asking' || phase === 'loading') && (
          <div className="contacts-busy" role="status">
            <Icon name="refresh" size={20} stroke={2} />
            <span>{phase === 'asking' ? tx('در حال گرفتن اجازه…') : tx('در حال خواندن مخاطبین…')}</span>
          </div>
        )}

        {(phase === 'denied' || phase === 'error') && (
          <div className="contacts-note" role="alert">
            <span className="tile peach" aria-hidden="true"><Icon name="info" size={17} stroke={1.9} /></span>
            <p>{note || tx('خواندن مخاطبین ممکن نشد.')}</p>
          </div>
        )}

        {(phase === 'denied' || phase === 'error') && (
          <button className="mini-btn" onClick={() => void load()}><Icon name="refresh" size={14} stroke={2.2} />{tx('تلاش دوباره')}</button>
        )}

        {(phase === 'ready' || phase === 'saving' || phase === 'done') && (
          <>
            {total === 0 ? (
              <div className="contacts-note">
                <span className="tile blue" aria-hidden="true"><Icon name="users" size={17} stroke={1.9} /></span>
                <p>{tx('مخاطبی با نام یا شماره پیدا نشد.')}</p>
              </div>
            ) : (
              <>
                <label className="search-field contacts-search">
                  <Icon name="search" size={18} stroke={1.9} />
                  <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('جستجو در مخاطبین')} aria-label={tx('جستجو در مخاطبین')} />
                </label>

                <div className="contacts-meta">
                  <span>{dupCount ? tn('{n} مخاطب · {a1} از قبل هست', total, { a1: fa(dupCount) }) : tn('{n} مخاطب', total)}</span>
                  <button className="text-btn" onClick={toggleAll}>{allShownChosen ? tx('برداشتن همه') : tx('انتخاب {a1}', { a1: query ? tx('نتایج') : tx('همه') })}</button>
                </div>

                <div className="contacts-list">
                  {shown.map((p) => {
                    const on = chosen.has(p.contactId);
                    return (
                      <button
                        key={p.contactId}
                        className={`contact-row${on ? ' on' : ''}`}
                        role="checkbox"
                        aria-checked={on}
                        onClick={() => toggle(p.contactId)}
                      >
                        <span className="c-check" aria-hidden="true">{on && <Icon name="check" size={13} stroke={3} />}</span>
                        <span className="c-body">
                          <b>{p.displayName}</b>
                          <span>{p.phones.length ? p.phones.slice(0, 2).join(' · ') : p.emails[0] ?? tx('بدون شماره')}</span>
                        </span>
                        {p.existing && <em className="c-dup">{tx('از قبل')}</em>}
                      </button>
                    );
                  })}
                  {visible.length > shown.length && <p className="hint contacts-more">{tn('و {n} مخاطب دیگر؛ برای دیدنشان جستجو کن.', visible.length - shown.length)}</p>}
                  {visible.length === 0 && <p className="hint contacts-more">{tx('مخاطبی با این نام پیدا نشد.')}</p>}
                </div>
              </>
            )}

            {phase === 'done' && note && (
              <p className="hint contacts-note-text" role="status">
                <Icon name="checkCircle" size={14} stroke={2} />
                {note}
              </p>
            )}
            {phase === 'done' ? (
              <button className="primary" onClick={onClose}><Icon name="check" size={18} stroke={2.4} />{tx('بستن')}</button>
            ) : (
              <button className="primary" disabled={phase !== 'ready' || chosen.size === 0} onClick={() => void save()}>
                <Icon name="plus" size={18} stroke={2.4} />
                {phase === 'saving' ? tx('در حال ذخیره…') : chosen.size ? tx('افزودن {a1} نفر', { a1: fa(chosen.size) }) : tx('کسی انتخاب نشده')}
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
