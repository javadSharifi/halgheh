import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type PersonTag, type Tag, db, del, put, uid } from './db';
import { normalize } from './search';
import { Icon } from './Icon';
import { locale, tx } from './i18n';

import { InputField, Button } from './ui';

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
  const nq = query ? normalize(query).n : '';
  // compare through the Persian normalizer (ي/ك variants, ZWNJ, digits), or "همكار" would become a second "همکار"
  const exists = nq ? allTags.find((t) => normalize(t.name).n === nq) : undefined;
  const already = !!exists && chosen.has(exists.id); // typed a tag this person already has
  const canCreate = query !== '' && query.length <= MAX_TAG && !exists;
  const canReuse = !!exists && !already;
  const suggestions = (nq ? known.filter((t) => normalize(t.name).n.includes(nq)) : known).slice(0, 12);

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
    if (busy || !canCreate) return;
    setBusy(true);
    try {
      const now = Date.now();
      const tag: Tag = { id: uid(), name: query, updatedAt: now };
      await put('tags', tag);
      await put('personTags', { id: `${personId}|${tag.id}`, personId, tagId: tag.id, updatedAt: now });
      setText('');
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (tagId: string) => {
    if (busy) return;
    const link = links.find((l) => l.tagId === tagId);
    if (!link) return;
    setBusy(true);
    try {
      await del('personTags', link.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tag-block">
      <div className="tag-chips">
        {links.map((l) => {
          const t = tags.find((x) => x.id === l.tagId) ?? allTags.find((x) => x.id === l.tagId);
          if (!t) return null;
          return (
            <button
              key={l.id}
              type="button"
              disabled={busy}
              className="tag-chip on c1"
              onClick={() => remove(l.tagId)}
              aria-label={tx('برداشتن برچسب {a1}', { a1: t.name })}
            >
              <bdi>{t.name}</bdi>
              <Icon name="close" size={13} stroke={2.4} />
            </button>
          );
        })}
        <button
          type="button"
          className="tag-chip tag-chip-add"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="plus" size={14} stroke={2.4} />
          {tx('برچسب')}
        </button>
      </div>

      {open && (
        <div className="tag-add">
          <InputField
            label={tx('برچسب تازه')}
            autoFocus
            value={text}
            maxLength={MAX_TAG}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (canCreate) void create();
                else if (canReuse && exists) void add(exists);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
              }
            }}
            placeholder={tx('مثلاً همکار')}
          />
          {canCreate && (
            <Button variant="primary" size="sm" icon="plus" disabled={busy} onClick={create}>
              {tx('ساختن «')}{query}»
            </Button>
          )}
          {canReuse && (
            <Button variant="primary" size="sm" icon="check" disabled={busy} onClick={() => add(exists)}>
              {tx('افزودن «')}{exists.name}»
            </Button>
          )}
          {already && <p className="hint pe-hint">{tx('این برچسب از قبل روی این فرد هست.')}</p>}
          {suggestions.length > 0 && (
            <div className="tag-chips">
              {suggestions.map((t) => (
                <button key={t.id} type="button" className="tag-chip" disabled={busy} onClick={() => add(t)}>
                  <bdi>{t.name}</bdi>
                </button>
              ))}
            </div>
          )}
          {query === '' && known.length === 0 && <p className="hint pe-hint">{tx('هنوز برچسبی ساخته نشده؛ اولی را همین‌جا بنویس.')}</p>}
        </div>
      )}
    </div>
  );
}
