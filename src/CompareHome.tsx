import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type CompareSession, type Rule, type RuleCategory } from './db';
import { db } from './db';
import { fa, label } from './cal';
import { ask } from './confirm';
import { Icon } from './Icon';
import { Button, FormPage, FormSection, InputField } from './ui';
import { Toggle } from './Toggle';
import { STR } from './strings/rulebook';
import { addRule, addSession, deleteRule, deleteSession, itemsOf, orderSessions, saveRule, setCompareEnabled } from './ruleData';
import { tx } from './i18n';

/**
 * Phase 5, step 1: the comparison entry inside one category. Offers starting a comparison, managing the category's
 * comparison criteria directly here, and opening or deleting previous sessions.
 */
export function CompareHome({ category, rules, onOpen, onClose }: {
  category: RuleCategory;
  rules: Rule[];
  onOpen: (sessionId: string) => void;
  onClose: () => void;
}) {
  const sessions = useLiveQuery(() => db.compareSessions.where('categoryId').equals(category.id).toArray(), [category.id]) ?? [];
  const items = useLiveQuery(() => db.compareItems.toArray(), []) ?? [];
  const [title, setTitle] = useState('');
  const [newCriterion, setNewCriterion] = useState('');
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

  const addCriterion = async () => {
    const clean = newCriterion.trim();
    if (!clean) return;
    setNewCriterion('');
    await addRule(category.id, clean);
  };

  const remove = async (s: CompareSession) => {
    const ok = await ask({ title: tx(STR.compare.deleteSessionTitle(s.title)), message: tx(STR.compare.deleteSessionBody), confirm: tx(STR.feature.delete), icon: 'trash' });
    if (ok) await deleteSession(s);
  };

  return (
    <FormPage title={`${tx(STR.compare.title)} · ${tx(category.name)}`} icon="contrast" onClose={onClose}>
      <div className="rf-row">
        <span className="tile purple" aria-hidden="true"><Icon name="contrast" size={17} stroke={1.9} /></span>
        <span className="rf-name">{tx(STR.categories.compareToggle)}</span>
        <Toggle on={!!category.compareEnabled} label={`${tx(STR.categories.compareToggle)} ${tx(category.name)}`} onChange={(on) => void setCompareEnabled(category, on)} />
      </div>

      {!category.compareEnabled && <p className="hint">{tx(STR.compare.compareDisabled)}</p>}

      {category.compareEnabled && (
        <>
          <FormSection title={tx(STR.compare.newSession)} icon="plus">
            <InputField
              label={tx('نام مقایسه')}
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void create(); } }}
              placeholder={tx(STR.compare.sessionTitlePlaceholder)}
              enterKeyHint="done"
            />
            <Button variant="primary" block disabled={busy} onClick={() => void create()} icon="plus">
              {tx('شروع مقایسه')}
            </Button>
          </FormSection>

          <FormSection title={tx('معیارهای مقایسه ({a1})', { a1: fa(rulesHere.length) })} icon="listChecks">
            <p className="hint">{tx('معیارهایی که هر کالا باید داشته باشد (مثل گارانتی، بودجه یا کیفیت) را اینجا بنویس.')}</p>
            {rulesHere.map((r) => (
              <div key={r.id} className="shop-crit-row">
                <span className="shop-crit-title">
                  <bdi>{r.title}</bdi>
                  {r.strict && <em className="rule-chip strict">{tx(STR.feature.strict)}</em>}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void saveRule(r, { strict: !r.strict })}
                  aria-pressed={!!r.strict}
                >
                  {r.strict ? tx('خط قرمز روشن') : tx('خط قرمز')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  icon="trash"
                  className="danger"
                  aria-label={`${tx(STR.feature.delete)} ${r.title}`}
                  onClick={() => void deleteRule(r)}
                />
              </div>
            ))}
            <div className="shop-inline-add">
              <InputField
                value={newCriterion}
                maxLength={200}
                onChange={(e) => setNewCriterion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addCriterion(); } }}
                placeholder={tx('معیار تازه، مثلاً گارانتی معتبر یا زیر ۵۰ میلیون')}
                aria-label={tx('معیار تازه')}
                enterKeyHint="done"
              />
              <Button variant="secondary" icon="plus" disabled={!newCriterion.trim()} onClick={() => void addCriterion()}>
                {tx('افزودن')}
              </Button>
            </div>
          </FormSection>

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
    </FormPage>
  );
}
