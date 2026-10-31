import { useMemo, useState } from 'react';
import { type Person, type Relationship, del, put } from './db';
import { ask } from './confirm';
import { Icon } from './Icon';
import { CONFIDENCE_LABEL, REL_LABEL, REL_TYPES, findLink, isSymmetric, linkId, linkIds } from './relationships';
import type { RelType } from './db';
import { locale, tx } from './i18n';

/**
 * Add or edit one link from a person's profile (R3). A symmetric link is saved once with the pair in sorted order, so
 * adding "دوست" from either person produces the same row instead of a mirror image.
 */
export function RelationshipForm({ personId, people, links, editing, onClose }: {
  personId: string;
  people: Person[];
  links: Relationship[];
  editing?: Relationship;
  onClose: () => void;
}) {
  const others = useMemo(
    () => people.filter((p) => !p.isSelf && !p.archivedAt && p.id !== personId).sort((a, b) => a.displayName.localeCompare(b.displayName, locale())),
    [people, personId],
  );
  const [otherId, setOtherId] = useState(() => {
    if (!editing) return '';
    return editing.aId === personId ? editing.bId : editing.aId;
  });
  const [type, setType] = useState<RelType>(editing?.type ?? 'friend');
  const [closeness, setCloseness] = useState(editing?.closeness !== undefined ? String(editing.closeness) : '');
  const [howMet, setHowMet] = useState(editing?.howMet ?? '');
  const [introducedBy, setIntroducedBy] = useState(editing?.introducedById ?? '');
  const [confidence, setConfidence] = useState<'sure' | 'maybe'>(editing?.confidence ?? 'sure');
  const [note, setNote] = useState(editing?.note ?? '');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const closenessNum = closeness.trim() === '' ? undefined : Number(closeness);
  const closenessOk = closenessNum === undefined || (Number.isInteger(closenessNum) && closenessNum >= 1 && closenessNum <= 5);
  const duplicate = !!otherId && !editing ? findLink(links, personId, otherId, type) : undefined;
  const valid = otherId !== '' && closenessOk && !duplicate;

  const shown = query.trim()
    ? others.filter((p) => p.displayName.includes(query.trim()) || p.nickname?.includes(query.trim()))
    : others;

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr('');
    try {
      let ids: { aId: string; bId: string };
      try {
        ids = linkIds(personId, otherId, type);
      } catch {
        setErr(tx('یک نفر نمی‌تواند با خودش رابطه داشته باشد.'));
        setBusy(false);
        return;
      }
      const row: Relationship = {
        id: linkId(personId, otherId, type),
        aId: ids.aId,
        bId: ids.bId,
        type,
        confidence,
        updatedAt: Date.now(),
      };
      if (closenessNum !== undefined) row.closeness = closenessNum;
      if (howMet.trim()) row.howMet = howMet.replace(/\s+/g, ' ').trim();
      if (introducedBy) row.introducedById = introducedBy;
      if (note.trim()) row.note = note.replace(/\s+/g, ' ').trim();
      await put('relationships', row);
      // a type change means a different link row; drop the old one, or the person ends up with both
      if (editing && editing.id !== row.id) await del('relationships', editing.id);
      onClose();
    } catch {
      setErr(tx('ذخیره نشد؛ دوباره تلاش کن.'));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing) return;
    if (!(await ask({ title: tx('این رابطه حذف شود؟'), message: tx('فقط همین پیوند پاک می‌شود؛ خود افراد می‌مانند.'), confirm: tx('حذف') }))) return;
    await del('relationships', editing.id);
    onClose();
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet rel-sheet" role="dialog" aria-modal="true" aria-labelledby="rel-title">
        <div className="bf-head">
          <span id="rel-title">{editing ? tx('ویرایش رابطه') : tx('رابطهٔ تازه')}</span>
          <button className="text-btn" onClick={onClose}>{tx('بستن')}</button>
        </div>

        <div className="pe-scroll">
          {!editing && (
            <>
              <label className="bf-name">
                <span>{tx('طرف دیگر')}</span>
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx('جستجوی نام…')} />
              </label>
              {others.length === 0 && <p className="hint pe-hint">{tx('برای ساختن رابطه دست‌کم دو نفر لازم است.')}</p>}
              <div className="rel-people">
                {shown.slice(0, 40).map((p) => (
                  <button key={p.id} type="button" className={`tag-chip${otherId === p.id ? ' on c1' : ''}`} onClick={() => setOtherId(p.id)}>
                    {p.displayName}
                  </button>
                ))}
                {shown.length === 0 && others.length > 0 && <p className="hint pe-hint">{tx('کسی با این نام پیدا نشد.')}</p>}
              </div>
            </>
          )}

          <div className="radios rel-types" role="radiogroup" aria-label={tx('نوع رابطه')}>
            {REL_TYPES.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={type === k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>
                {tx(REL_LABEL[k])}
              </button>
            ))}
          </div>
          <p className="hint pe-hint">
            {isSymmetric(type) ? tx('این رابطه دوطرفه است؛ یک بار ثبت می‌شود و برای هر دو نفر دیده می‌شود.') : tx('«معرفی‌شده» یک‌طرفه است: یعنی این فرد، آن یکی را به تو معرفی کرده.')}
          </p>
          {duplicate && <p className="form-error" role="alert">{tx('این رابطه از قبل ثبت شده است.')}</p>}

          <div className="pe-grid">
            <label className="bf-tile"><span>{tx('نزدیکی (۱–۵)')}</span><input inputMode="numeric" value={closeness} onChange={(e) => setCloseness(e.target.value)} /></label>
            <div className="bf-tile">
              <span>{tx('اطمینان')}</span>
              <button type="button" className="as-value" onClick={() => setConfidence(confidence === 'sure' ? 'maybe' : 'sure')}>
                {tx(CONFIDENCE_LABEL[confidence])}
              </button>
            </div>
          </div>
          {!closenessOk && <p className="form-error">{tx('نزدیکی باید عددی بین ۱ و ۵ باشد.')}</p>}

          <label className="bf-name"><span>{tx('از کجا می‌شناسیشان (اختیاری)')}</span><input value={howMet} maxLength={200} onChange={(e) => setHowMet(e.target.value)} /></label>
          <div className="rf-row">
            <span className="tile green" aria-hidden="true"><Icon name="users" size={17} stroke={1.9} /></span>
            <span className="rf-name">{tx('معرف')}</span>
            <select className="as-value" aria-label={tx('معرف')} value={introducedBy} onChange={(e) => setIntroducedBy(e.target.value)}>
              <option value="">{tx('مشخص نیست')}</option>
              {others.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
            </select>
          </div>
          <label className="bf-name bf-name-top">
            <span>{tx('یادداشت (اختیاری)')}</span>
            <textarea className="rf-text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} />
          </label>

          {err && <p className="form-error" role="alert">{err}</p>}
        </div>

        <button className="primary" disabled={!valid || busy} onClick={() => void save()}>
          <Icon name="check" size={18} stroke={2.4} />
          {busy ? tx('در حال ذخیره…') : editing ? tx('ذخیره') : tx('افزودن رابطه')}
        </button>
        {editing && <button className="danger-btn" onClick={() => void remove()}><Icon name="trash" size={16} stroke={2} />{tx('حذف این رابطه')}</button>}
      </section>
    </>
  );
}
