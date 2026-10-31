import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type PersonTag, type Tag, db, del, put, uid } from './db';
import { normalize } from './search';
import { Icon } from './Icon';
import { locale, tx } from './i18n';

const MAX_TAG = 30;

/**
 * Tags are free text shared by every person. Picking an existing name links to that tag row instead of making a second
 * one with the same name, so "همکار" means the same thing everywhere and P5 can filter by it.
 */
export function TagEditor({ personId, links, tags }: { personId: string; links: PersonTag[]; tags: Tag[] }) {
  const allTags = useLiveQuery(() => db.tags.toArray(), []) ?? [];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const chosen = new Set(links.map((l) => l.tagId));
  const known = [...new Map([...tags, ...allTags].map((t) => [t.id, t])).values()]
    .filter((t) => !chosen.has(t.id))
    .sort((a, b) => a.name.localeCompare(b.name, locale()));
  const query = text.replace(/\s+/g, ' ').trim();
  // compare through the Persian normalizer (ي/ك variants, ZWNJ, digits), or "همكار" would become a second "همکار"
  const exists = query ? allTags.find((t) => normalize(t.name).n === normalize(query).n) : undefined;
  const already = !!exists && chosen.has(exists.id); // typed a tag this person already has
  const canCreate = query !== '' && query.length <= MAX_TAG && !exists;
  const canReuse = !!exists && !already;

  const add = async (tag: Tag) => {
    if (busy || chosen.has(tag.id)) return;
    setBusy(true);
    try {
      await put('personTags', { id: `${personId}|${tag.id}`, personId, tagId: tag.id, updatedAt: Date.now() });
      setText('');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    if (!canCreate) return;
    setBusy(true);
    try {
      const tag: Tag = { id: uid(), name: query, updatedAt: Date.now() };
      await put('tags', tag);
      await add(tag);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (tagId: string) => {
    const link = links.find((l) => l.tagId === tagId);
    if (link) await del('personTags', link.id);
  };

  return (
    <div className="tag-block">
      <div className="tag-chips">
        {links.map((l) => {
          const t = tags.find((x) => x.id === l.tagId) ?? allTags.find((x) => x.id === l.tagId);
          if (!t) return null;
          return (
            <button key={l.id} className="tag-chip on c1" onClick={() => remove(l.tagId)} aria-label={tx('برداشتن برچسب {a1}', { a1: t.name })}>
              <bdi>{t.name}</bdi>
              <Icon name="close" size={13} stroke={2.4} />
            </button>
          );
        })}
        <button className="tag-chip" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name="plus" size={14} stroke={2.4} />{tx('برچسب')}</button>
      </div>

      {open && (
        <div className="tag-add">
          <label className="bf-name">
            <span>{tx('برچسب تازه')}</span>
            <input autoFocus value={text} maxLength={MAX_TAG} onChange={(e) => setText(e.target.value)} placeholder={tx('مثلاً همکار')} />
          </label>
          {canCreate && <button className="mini-btn primary" disabled={busy} onClick={create}><Icon name="plus" size={14} stroke={2.4} />{tx('ساختن «')}{query}»</button>}
          {canReuse && <button className="mini-btn primary" disabled={busy} onClick={() => add(exists)}><Icon name="check" size={14} stroke={2.4} />{tx('افزودن «')}{exists.name}»</button>}
          {already && <p className="hint pe-hint">{tx('این برچسب از قبل روی این فرد هست.')}</p>}
          {known.length > 0 && (
            <div className="tag-chips">
              {known.slice(0, 12).map((t) => (
                <button key={t.id} className="tag-chip" disabled={busy} onClick={() => add(t)}><bdi>{t.name}</bdi></button>
              ))}
            </div>
          )}
          {query === '' && known.length === 0 && <p className="hint pe-hint">{tx('هنوز برچسبی ساخته نشده؛ اولی را همین‌جا بنویس.')}</p>}
        </div>
      )}
    </div>
  );
}
