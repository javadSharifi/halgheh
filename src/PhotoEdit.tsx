import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Photo, type Person, type Tag, db, put } from './db';
import { fa, today } from './cal';
import { titleFromName } from './photos';
import { storePhoto } from './storePhoto';
import type { Picked } from './photoStore';
import { Icon } from './Icon';
import { DatePicker } from './DatePicker';
import { locale, tx } from './i18n';
import { personLabel } from './format';
import { FormField, FormPage, FormSection, InputField, Select } from './ui';

/** Edit a photo's metadata (G1): title, note, date, an optional person link and tags. G2 wires the same fields into search. */
export function PhotoEdit({ photo, pending, step, seedPersonId, onClose, onSaved }: {
  photo?: Photo;
  /** A freshly picked image that is not stored yet: saving creates the photo with these fields. */
  pending?: Picked;
  step?: { n: number; of: number };
  seedPersonId?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const tags = useLiveQuery(() => db.tags.toArray(), []) ?? [];
  const [v, setV] = useState(() => ({
    title: photo?.title ?? (pending ? titleFromName(pending.name) || tx('عکس') : ''),
    note: photo?.note ?? '',
    takenAt: photo?.takenAt ?? today(),
    personId: photo?.personId ?? seedPersonId ?? '',
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
    if ((!photo && !pending) || !valid || busy) return;
    setBusy(true);
    setErr('');
    try {
      const meta = { title: v.title.replace(/\s+/g, ' ').trim(), takenAt: v.takenAt, tagIds: v.tagIds, note: v.note.replace(/\s+/g, ' ').trim() || undefined, personId: v.personId || undefined };
      if (photo) {
        const row: Photo = { ...photo, ...meta, updatedAt: Date.now() };
        if (!meta.note) delete row.note;
        if (!meta.personId) delete row.personId;
        await put('photos', row);
        onClose();
      } else if (pending) {
        const { note, personId, ...rest } = meta;
        await storePhoto(pending, { ...rest, ...(note && { note }), ...(personId && { personId }) });
        setBusy(false);
        onSaved?.();
      }
    } catch {
      setErr(tx('ذخیره نشد؛ دوباره تلاش کن.'));
      setBusy(false);
    }
  };

  return (
    <>
      <FormPage
        title={pending ? (step ? tx('عکس {a1} از {a2}', { a1: fa(step.n), a2: fa(step.of) }) : tx('افزودن عکس')) : tx('ویرایش عکس')}
        icon={pending ? 'plus' : 'edit'}
        onClose={onClose}
        onSave={() => void save()}
        saveLabel={pending ? tx('ثبت') : undefined}
        saveDisabled={!valid}
        busy={busy}
        error={err}
      >
        {pending && <img className="photo-preview" src={pending.webPath} alt="" />}
        <FormSection>
          <InputField
            label={tx('عنوان')}
            autoFocus
            value={v.title}
            maxLength={120}
            onChange={(e) => set({ title: e.target.value })}
          />
          <InputField
            label={tx('یادداشت')}
            multiline
            rows={3}
            value={v.note}
            maxLength={600}
            onChange={(e) => set({ note: e.target.value })}
          />

          <div className="rf-row">
            <span className="tile blue" aria-hidden="true"><Icon name="calendar" size={17} stroke={1.9} /></span>
            <span className="rf-name">{tx('تاریخ')}</span>
            <button type="button" className="rf-value as-text" onClick={() => setPicking(true)}>
              {v.takenAt}
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          </div>

          <Select
            label={tx('شخص')}
            value={v.personId}
            onChange={(e) => set({ personId: e.target.value })}
            options={[{ value: '', label: tx('بدون شخص') }, ...sortedPeople.map((p: Person) => ({ value: p.id, label: personLabel(p) }))]}
          />

          {tags.length > 0 && (
            <FormField label={tx('برچسب‌ها')}>
              <div className="tag-chips">
                {tags.map((t: Tag) => (
                  <button key={t.id} type="button" className={`tag-chip${v.tagIds.includes(t.id) ? ' on c1' : ''}`} aria-pressed={v.tagIds.includes(t.id)} onClick={() => toggleTag(t.id)}>
                    {t.name}
                  </button>
                ))}
              </div>
            </FormField>
          )}
        </FormSection>
      </FormPage>
      {picking && <DatePicker value={v.takenAt} onPick={(d) => { set({ takenAt: d }); setPicking(false); }} onClose={() => setPicking(false)} />}
    </>
  );
}
