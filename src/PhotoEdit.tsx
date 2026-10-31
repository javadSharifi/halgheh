import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Photo, type Person, type Tag, db, put } from './db';
import { today } from './cal';
import { Icon } from './Icon';
import { DatePicker } from './DatePicker';
import { locale, tx } from './i18n';

/** Edit a photo's metadata (G1): title, note, date, an optional person link and tags. G2 wires the same fields into search. */
export function PhotoEdit({ photo, onClose }: { photo?: Photo; onClose: () => void }) {
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const tags = useLiveQuery(() => db.tags.toArray(), []) ?? [];
  const [v, setV] = useState(() => ({
    title: photo?.title ?? '',
    note: photo?.note ?? '',
    takenAt: photo?.takenAt ?? today(),
    personId: photo?.personId ?? '',
    tagIds: photo?.tagIds ?? [],
  }));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));

  const valid = v.title.trim() !== '';
  const sortedPeople = [...people].filter((p) => !p.archivedAt).sort((a, b) => a.displayName.localeCompare(b.displayName, locale()));

  const toggleTag = (id: string) =>
    set({ tagIds: v.tagIds.includes(id) ? v.tagIds.filter((x) => x !== id) : [...v.tagIds, id] });

  const save = async () => {
    if (!photo || !valid || busy) return;
    setBusy(true);
    setErr('');
    try {
      const row: Photo = { ...photo, title: v.title.replace(/\s+/g, ' ').trim(), takenAt: v.takenAt, tagIds: v.tagIds, updatedAt: Date.now() };
      if (v.note.trim()) row.note = v.note.replace(/\s+/g, ' ').trim();
      else delete row.note;
      if (v.personId) row.personId = v.personId;
      else delete row.personId;
      await put('photos', row);
      onClose();
    } catch {
      setErr(tx('ذخیره نشد؛ دوباره تلاش کن.'));
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet photo-sheet" role="dialog" aria-modal="true" aria-labelledby="photo-title">
        <div className="bf-head">
          <span id="photo-title">{tx('ویرایش عکس')}</span>
          <button className="text-btn" onClick={onClose}>{tx('بستن')}</button>
        </div>

        <div className="pe-scroll">
          <label className="bf-name"><span>{tx('عنوان')}</span><input autoFocus value={v.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} /></label>
          <label className="bf-name bf-name-top"><span>{tx('یادداشت')}</span><textarea className="rf-text" value={v.note} onChange={(e) => set({ note: e.target.value })} maxLength={600} /></label>

          <div className="rf-row">
            <span className="tile blue" aria-hidden="true"><Icon name="calendar" size={17} stroke={1.9} /></span>
            <span className="rf-name">{tx('تاریخ')}</span>
            <button type="button" className="rf-value as-text" onClick={() => setPicking(true)}>
              {v.takenAt}
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          </div>

          <div className="rf-row">
            <span className="tile green" aria-hidden="true"><Icon name="users" size={17} stroke={1.9} /></span>
            <span className="rf-name">{tx('شخص')}</span>
            <select className="as-value" aria-label={tx('شخص')} value={v.personId} onChange={(e) => set({ personId: e.target.value })}>
              <option value="">{tx('بدون شخص')}</option>
              {sortedPeople.map((p: Person) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </div>

          {tags.length > 0 && (
            <>
              <p className="field-label">{tx('برچسب‌ها')}</p>
              <div className="tag-chips">
                {tags.map((t: Tag) => (
                  <button key={t.id} type="button" className={`tag-chip${v.tagIds.includes(t.id) ? ' on c1' : ''}`} aria-pressed={v.tagIds.includes(t.id)} onClick={() => toggleTag(t.id)}>
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {err && <p className="form-error" role="alert">{err}</p>}
        </div>

        <button className="primary" disabled={!valid || busy} onClick={() => void save()}>
          <Icon name="check" size={18} stroke={2.4} />
          {busy ? tx('در حال ذخیره…') : tx('ذخیره')}
        </button>
      </section>
      {picking && <DatePicker value={v.takenAt} onPick={(d) => { set({ takenAt: d }); setPicking(false); }} onClose={() => setPicking(false)} />}
    </>
  );
}
