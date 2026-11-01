import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Task, db, put } from './db';
import { addRule, addSession, deleteRule, ensureShoppingCategory, itemsOf } from './ruleData';
import { CompareSessionPage } from './CompareSessionPage';
import { CompareCheckMode } from './CompareCheck';
import { Button, FormSection, InputField } from './ui';
import { tx } from './i18n';

/**
 * The shopping half of a shopping task: the rules a purchase must meet, and the candidate products to compare against
 * them. It reuses the rulebook's purchase comparison, so a task only keeps `compareSessionId`; the rules live in the
 * shared «خرید» rule category.
 */
export function ShoppingSection({ task }: { task: Task }) {
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? [];
  const cats = useLiveQuery(() => db.ruleCategories.toArray(), []) ?? [];
  const items = useLiveQuery(() => db.compareItems.toArray(), []) ?? [];
  const session = useLiveQuery(() => (task.compareSessionId ? db.compareSessions.get(task.compareSessionId) : undefined), [task.compareSessionId]);
  const [newRule, setNewRule] = useState('');
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState<{ itemId: string; categoryId: string } | null>(null);
  const [catId, setCatId] = useState<string | null>(null);

  const cat = cats.find((c) => c.id === catId);
  const mine = rules.filter((r) => r.categoryId === catId && !r.archivedAt);
  useEffect(() => {
    void ensureShoppingCategory().then((c) => setCatId(c.id));
  }, []);

  // the comparison screens are overlays, so the Android back button reaches them through this hook (App asks it first)
  useEffect(() => {
    if (!open) return;
    const w = window as unknown as { __rulebookBack?: () => boolean };
    w.__rulebookBack = () => {
      if (checking) setChecking(null);
      else setOpen(false);
      return true;
    };
    return () => { delete w.__rulebookBack; };
  }, [open, checking]);

  const add = async () => {
    if (!catId || !newRule.trim()) return;
    await addRule(catId, newRule.trim());
    setNewRule('');
  };

  const start = async () => {
    if (!catId) return;
    const s = session ?? (await addSession(catId, task.title));
    if (!session) await put('tasks', { ...task, compareSessionId: s.id, updatedAt: Date.now() });
    setOpen(true);
  };

  const count = session ? itemsOf(items, session.id).length : 0;

  return (
    <>
      <FormSection title={tx('قوانین خرید')} icon="listChecks">
        <p className="hint">{tx('هر محصول با این قوانین سنجیده می‌شود؛ مثلاً «حداقل ۸ گیگ رم» یا «گارانتی دارد».')}</p>
        {mine.map((r) => (
          <div key={r.id} className="rf-row">
            <span className="rf-name">{r.title}</span>
            <Button variant="ghost" size="icon-sm" icon="trash" aria-label={`${tx('حذف')} ${r.title}`} onClick={() => void deleteRule(r)} />
          </div>
        ))}
        <InputField
          label={tx('قانون تازه')}
          value={newRule}
          maxLength={200}
          onChange={(e) => setNewRule(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }}
          enterKeyHint="done"
        />
        <Button variant="secondary" block icon="plus" disabled={!newRule.trim()} onClick={() => void add()}>{tx('افزودن قانون')}</Button>
      </FormSection>

      <FormSection title={tx('مقایسهٔ محصولات')} icon="contrast">
        <p className="hint">{tx('چند محصول (مثلاً چند گوشی) وارد کن و ببین کدام با قوانین خرید می‌خواند.')}</p>
        <Button variant="primary" block icon="contrast" disabled={!catId} onClick={() => void start()}>
          {session ? tx('باز کردن مقایسه ({a1} محصول)', { a1: String(count) }) : tx('شروع مقایسهٔ محصولات')}
        </Button>
      </FormSection>

      {open && session && cat && (
                    <CompareSessionPage
              sessionId={session.id}
              rules={rules}
              onCategory={() => {}}
              onBack={() => { setOpen(false); setChecking(null); }}
              onOpenCheck={(itemId) => setChecking({ itemId, categoryId: cat.id })}
            />
      )}
      {checking && (
                    <CompareCheckMode
              itemId={checking.itemId}
              rules={rules.filter((r) => !r.archivedAt && r.categoryId === checking.categoryId)}
              onClose={() => setChecking(null)}
            />
      )}
    </>
  );
}
