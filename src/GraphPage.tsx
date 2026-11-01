import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type RelType } from './db';
import { REL_TYPES } from './db/types';
import { layout } from './domain/graph/layout';
import { personLabel } from './format';
import { Icon } from './Icon';
import { tx } from './i18n';
import { REL_LABEL } from './relationships';
import { CIRCLES } from './circles';
import { Button, Card, Select } from './ui';

const COLOR: Record<RelType, string> = {
  family: '#e8875c', friend: '#3e63dd', colleague: '#7a5bda', neighbor: '#2b7352', classmate: '#c2850c', acquaintance: '#8d92b0', introduced: '#d64545',
};
const CIRCLE_COLOR: Record<string, string> = { close: '#d64545', friend: '#3e63dd', acquaintance: '#8d92b0', distant: '#c3c7da', '': '#b8bcd0' };
const ME = 'me';
/** `me` edges link the user to every person, so someone nobody introduced still has a place in the graph. */
type Edge = { a: string; b: string; type: RelType | 'me'; color: string; dashed?: boolean; arrow?: boolean };

/**
 * The relationship graph: who is connected to whom and who introduced whom. People with no link are left out. Tap a person
 * to light up their links and read them below.
 */
export function GraphPage({ openPerson, onClose }: { openPerson: (id: string) => void; onClose: () => void }) {
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const rels = useLiveQuery(() => db.relationships.toArray(), []) ?? [];
  const [type, setType] = useState<RelType | ''>('');
  const [sel, setSel] = useState<string | null>(null);

  const self = people.find((p) => p.isSelf);
  const meId = self?.id ?? ME;
  const live = useMemo(() => people.filter((p) => !p.archivedAt), [people]);
  const byId = useMemo(() => new Map(live.map((p) => [p.id, p])), [live]);
  const nameOf = (id: string) => (id === meId ? tx('من') : (byId.get(id) ? personLabel(byId.get(id)!) : '…'));
  const edges = useMemo(() => {
    const out: Edge[] = [];
    // the user is the centre: a spoke to everyone, tinted by closeness, unless a relationship type is being filtered
    if (!type) for (const p of live) if (!p.isSelf) out.push({ a: meId, b: p.id, type: 'me', color: CIRCLE_COLOR[p.circle ?? ''] });
    for (const r of rels) {
      if (!byId.has(r.aId) || !byId.has(r.bId)) continue;
      if (type && r.type !== type) continue;
      out.push({ a: r.aId, b: r.bId, type: r.type, color: COLOR[r.type], arrow: r.type === 'introduced' });
      // optional: a third person who made the introduction, drawn as a dashed arrow to both ends of the link
      if (r.introducedById && byId.has(r.introducedById) && !type) {
        out.push({ a: r.introducedById, b: r.aId, type: 'introduced', color: COLOR.introduced, dashed: true, arrow: true });
        out.push({ a: r.introducedById, b: r.bId, type: 'introduced', color: COLOR.introduced, dashed: true, arrow: true });
      }
    }
    return out;
  }, [rels, byId, live, type, meId]);
  const nodes = useMemo(() => [...new Set(edges.flatMap((e) => [e.a, e.b]))].map((id) => ({ id })), [edges]);
  const size = Math.max(340, Math.round(Math.sqrt(nodes.length) * 120));
  const pos = useMemo(() => layout(nodes, edges, size, size), [nodes, edges, size]);
  const mine = sel && sel !== meId ? edges.filter((e) => !e.dashed && (e.a === sel || e.b === sel)) : [];
  const near = new Set(mine.flatMap((e) => [e.a, e.b]));
  const intros = sel ? edges.filter((e) => e.dashed && e.a === sel).length : 0;

  return (
    <>
      <header className="dd-head">
        <Button variant="ghost" size="icon-md" aria-label={tx('بازگشت')} onClick={onClose} icon="chevronRight" />
        <span>{tx('گراف رابطه‌ها')}</span>
        <span className="head-spacer" />
      </header>

      <Select
        label={tx('نوع رابطه')}
        value={type}
        onChange={(e) => { setType(e.target.value as RelType | ''); setSel(null); }}
        options={[{ value: '', label: tx('همه') }, ...REL_TYPES.map((k) => ({ value: k, label: tx(REL_LABEL[k]) }))]}
      />

      {live.filter((p) => !p.isSelf).length === 0 ? (
        <Card className="empty-state">
          <span className="tile purple" aria-hidden="true"><Icon name="users" size={24} stroke={1.8} /></span>
          <b>{tx('هنوز کسی در گراف نیست')}</b>
          <p className="hint">{tx('افراد را اضافه کن تا دور تو بنشینند؛ رابطهٔ آن‌ها با هم را در پروفایل (ارزیابی) ثبت کن.')}</p>
        </Card>
      ) : (
        <>
          <div className="graph-legend">
            {REL_TYPES.map((k) => (
              <span key={k}><i style={{ background: COLOR[k] }} />{tx(REL_LABEL[k])}</span>
            ))}
            {!type && CIRCLES.map((c) => (
              <span key={c.key}><i style={{ background: CIRCLE_COLOR[c.key] }} />{tx('با من')}: {tx(c.name)}</span>
            ))}
          </div>
          <div className="graph-wrap" dir="ltr">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={tx('گراف رابطه‌ها')}>
              <defs>
                <marker id="g-arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0 0L10 5L0 10z" fill="context-stroke" />
                </marker>
              </defs>
              {edges.map((e, i) => {
                const a = pos[e.a]; const b = pos[e.b];
                if (!a || !b) return null;
                const lit = !sel || e.a === sel || e.b === sel;
                return (
                  <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.color} strokeWidth={lit ? (e.type === 'me' ? 1.6 : 2.4) : 1} strokeDasharray={e.dashed ? '5 4' : undefined} opacity={lit ? 0.9 : 0.15} markerEnd={e.arrow ? 'url(#g-arrow)' : undefined} />
                );
              })}
              {nodes.map(({ id }) => {
                const p = byId.get(id); const c = pos[id];
                if (!c || (!p && id !== meId)) return null;
                const isMe = id === meId;
                const name = nameOf(id);
                const dim = sel && id !== sel && !near.has(id) && !(sel === meId);
                return (
                  <g key={id} transform={`translate(${c.x} ${c.y})`} opacity={dim ? 0.3 : 1} onClick={() => setSel(sel === id ? null : id)} style={{ cursor: 'pointer' }}>
                    <circle r={isMe ? 24 : id === sel ? 21 : 17} fill={isMe ? 'var(--blue)' : 'var(--sheet)'} stroke={id === sel ? 'var(--blue)' : 'var(--line-2)'} strokeWidth={id === sel ? 3 : 1.5} />
                    <text textAnchor="middle" dy="5" fontSize={isMe ? 15 : 14} fontWeight="800" fill={isMe ? '#fff' : 'var(--ink-strong)'}>{name.slice(0, 1)}</text>
                    <text textAnchor="middle" dy={isMe ? 40 : 34} fontSize="11" fontWeight="600" fill="var(--ink-2)">{name.length > 10 ? `${name.slice(0, 9)}…` : name}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      )}

      {sel && (sel === meId || byId.get(sel)) && (
        <section className="glass followups-card">
          <div className="fc-head">
            <h2><bdi>{nameOf(sel)}</bdi></h2>
            {sel !== meId && <Button size="sm" variant="primary" onClick={() => openPerson(sel)}>{tx('پروفایل')}</Button>}
          </div>
          {sel === meId && <p className="hint">{tx('مرکز گراف تویی؛ هر خط رنگی یعنی یک نفر از آشنایانت، به رنگ میزان صمیمیت.')}</p>}
          {sel !== meId && mine.length === 0 && <p className="hint">{tx('رابطه‌ای با این فیلتر ندارد.')}</p>}
          {mine.map((e, i) => {
            const other = e.a === sel ? e.b : e.a;
            const dir = e.type === 'me' ? tx('در آشنایان من') : e.type === 'introduced' ? (e.a === sel ? tx('معرفی کرده') : tx('معرفی‌شده توسط')) : tx(REL_LABEL[e.type]);
            return (
              <button key={i} type="button" className="fc-row" onClick={() => setSel(other)}>
                <span className="graph-dot" style={{ background: e.color }} />
                <div className="fc-details"><span className="fc-name"><bdi>{nameOf(other)}</bdi></span><span className="fc-sub">{dir}</span></div>
              </button>
            );
          })}
          {intros > 0 && <p className="hint">{tx('{a1} رابطه را او معرفی کرده است.', { a1: String(intros / 2) })}</p>}
        </section>
      )}
    </>
  );
}
