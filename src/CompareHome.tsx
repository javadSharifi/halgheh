import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type CompareSession, type Rule, type RuleCategory } from './db';
import { db } from './db';
import { fa, label } from './cal';
import { ask } from './confirm';
import { Icon } from './Icon';
import { Button } from './ui';
import { Toggle } from './Toggle';
import { STR } from './strings/rulebook';
import { addSession, itemsOf, orderSessions, setCompareEnabled, deleteSession } from './ruleData';
import { tx } from './i18n';

/**
 * Phase 5, step 1: the comparison entry inside one category. Only categories with `compareEnabled` get it; the switch is
 * offered here too, so turning it on is one tap away from where the user is. Open sessions are listed before decided ones.
 */
export function CompareHome({ category, rules, onOpen, onClose }: {
  category: RuleCategory;
  rules: Rule[];
  onOpen: (sessionId: string) => void;
  onClose: () => void;
}) {
  const sessions = useLiveQuery(() => db.compareSessions.where('categoryId').equals(category.id).toArray(), []) ?? [];
  const items = useLiveQuery(() => db.compareItems.toArray(), []) ?? [];
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const ordered = useMemo(() => orderSessions(sessions), [sessions]);
  const rulesHere = rules.filter((r) => r.categoryId === category.id && !r.archivedAt);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const row = await addSession(category.id, title.trim() || tx('مقایسهٔ {a1}', { a1: tx(category.name) }));
      setTitle('');
      onOpen(row.id);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: CompareSession) => {
    const ok = await ask({ title: tx(STR.compare.deleteSessionTitle(s.title)), message: tx(STR.compare.deleteSessionBody), confirm: tx(STR.feature.delete), icon: 'trash' });
    if (ok) await deleteSession(s);
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet compare-home" role="dialog" aria-modal="true" aria-labelledby="compare-home-title">
        <div className="bf-head">
          <span id="compare-home-title">{tx(STR.compare.title)} · {tx(category.name)}</span>
          <Button variant="ghost" size="sm" onClick={onClose}>{tx(STR.feature.close)}</Button>
        </div>

        <div className="rf-row">
          <span className="tile purple" aria-hidden="true"><Icon name="contrast" size={17} stroke={1.9} /></span>
          <span className="rf-name">{tx(STR.categories.compareToggle)}</span>
          <Toggle on={!!category.compareEnabled} label={`${tx(STR.categories.compareToggle)} ${tx(category.name)}`} onChange={(on) => void setCompareEnabled(category, on)} />
        </div>

        {!category.compareEnabled && <p className="hint">{tx(STR.compare.compareDisabled)}</p>}

        {category.compareEnabled && (
          <>
            {rulesHere.length === 0 && <p className="hint">{tx(STR.compare.noRules)}</p>}
            <div className="cat-add">
              <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={tx(STR.compare.sessionTitlePlaceholder)} aria-label={tx(STR.compare.newSession)} enterKeyHint="done" />
              <Button variant="primary" size="sm" disabled={busy || rulesHere.length === 0} onClick={() => void create()} icon="plus">
                {tx(STR.compare.newSession)}
              </Button>
            </div>

            <p className="field-label">{tx(STR.compare.sessions)}</p>
            <div className="session-list">
              {ordered.length === 0 && <p className="hint">{tx(STR.compare.noSessions)}</p>}
              {ordered.map((s) => {
                const n = itemsOf(items, s.id).length;
                return (
                  <div key={s.id} className="session-row">
                    <button className="session-open" onClick={() => onOpen(s.id)}>
                      <span className={`tile ${s.status === 'decided' ? 'green' : 'blue'}`} aria-hidden="true"><Icon name={s.status === 'decided' ? 'checkCircle' : 'contrast'} size={16} stroke={1.9} /></span>
                      <span className="set-name">
                        {s.title}
                        <small className="set-sub">
                          {s.status === 'decided' ? tx(STR.compare.decidedSession) : tx(STR.compare.openSession)} · {fa(n)} {tx(STR.compare.items)}
                          {' · '}
                          {label(new Date(s.updatedAt).toLocaleDateString('sv'), 'persian', 0, { day: 'numeric', month: 'long' })}
                        </small>
                      </span>
                      <Icon name="chevronLeft" size={16} stroke={2} />
                    </button>
                    <Button variant="ghost" size="icon-sm" className="danger" aria-label={`${tx(STR.feature.delete)} ${s.title}`} onClick={() => void remove(s)} icon="trash" />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>
    </>
  );
}
