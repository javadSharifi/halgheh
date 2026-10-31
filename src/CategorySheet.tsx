import { useState } from 'react';
import { type Rule, type RuleCategory } from './db';
import { fa } from './cal';
import { ask } from './confirm';
import { Icon } from './Icon';
import { Toggle } from './Toggle';
import { Choice } from './Choice';
import { STR } from './strings/rulebook';
import { addCategory, deleteCategory, deleteCategory as removeCategory, moveCategory, renameCategory, setCompareEnabled } from './ruleData';

/**
 * Phase 2: category management. Add, rename, reorder, delete and the per-category purchase-comparison switch. Deleting a
 * category that still holds rules asks where those rules go first, in the same sheet, so the answer can never be skipped.
 */
export function CategorySheet({ categories, rules, onClose }: { categories: RuleCategory[]; rules: Rule[]; onClose: () => void }) {
  const [adding, setAdding] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [err, setErr] = useState('');
  /** The category whose deletion is waiting for "where do its rules go". */
  const [pending, setPending] = useState<RuleCategory | null>(null);
  const [target, setTarget] = useState<string>('');
  const busy = false;

  const countIn = (id: string) => rules.filter((r) => r.categoryId === id).length;

  const add = async () => {
    const name = adding.trim();
    if (!name) return;
    if (categories.some((c) => c.name.trim() === name)) return setErr(STR.categories.nameTaken);
    setErr('');
    await addCategory(categories, name);
    setAdding('');
  };

  const rename = async () => {
    if (!renaming) return;
    const cat = categories.find((c) => c.id === renaming.id);
    const name = renaming.name.trim();
    if (!cat) return;
    if (!name) return setErr(STR.categories.emptyName);
    if (categories.some((c) => c.id !== cat.id && c.name.trim() === name)) return setErr(STR.categories.nameTaken);
    setErr('');
    await renameCategory(cat, name);
    setRenaming(null);
  };

  const remove = async (cat: RuleCategory) => {
    setErr('');
    if (categories.length <= 1) {
      await ask({ title: STR.categories.deleteLastTitle, message: STR.categories.deleteLastBody, confirm: STR.feature.close, icon: 'info', tone: 'default' });
      return;
    }
    const n = countIn(cat.id);
    if (n === 0) {
      const ok = await ask({ title: STR.categories.deleteTitle(cat.name), message: STR.categories.deleteEmptyBody, confirm: STR.categories.deleteConfirm });
      if (ok) await deleteCategory(cat, [], { deleteRules: true });
      return;
    }
    // non-empty: the sheet below asks where the rules go before anything is deleted
    setPending(cat);
    setTarget(categories.find((c) => c.id !== cat.id)?.id ?? '');
  };

  const others = pending ? categories.filter((c) => c.id !== pending.id) : [];

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet cat-sheet" role="dialog" aria-modal="true" aria-labelledby="cat-sheet-title">
        <div className="bf-head">
          <span id="cat-sheet-title">{pending ? STR.categories.deleteTitle(pending.name) : STR.categories.manageTitle}</span>
          <button className="text-btn" onClick={() => (pending ? setPending(null) : onClose())}>{pending ? STR.feature.cancel : STR.feature.close}</button>
        </div>

        {!pending && (
          <>
            <div className="cat-add">
              <input value={adding} maxLength={60} onChange={(e) => setAdding(e.target.value)} placeholder={STR.categories.namePlaceholder} aria-label={STR.categories.add} enterKeyHint="done" />
              <button className="mini-btn" disabled={!adding.trim()} onClick={() => void add()}><Icon name="plus" size={14} stroke={2.4} />{STR.categories.add}</button>
            </div>

            <div className="cat-list">
              {categories.map((cat, i) => (
                <div key={cat.id} className="cat-row">
                  <span className="tile purple" aria-hidden="true"><Icon name="alignLeft" size={16} stroke={1.9} /></span>
                  {renaming?.id === cat.id ? (
                    <form
                      className="cat-rename"
                      onSubmit={(e) => { e.preventDefault(); void rename(); }}
                    >
                      <input autoFocus value={renaming.name} maxLength={60} onChange={(e) => setRenaming({ id: cat.id, name: e.target.value })} aria-label={STR.categories.rename} />
                      <button type="submit" className="icon-btn small" aria-label={STR.feature.save}><Icon name="check" size={17} stroke={2.4} /></button>
                    </form>
                  ) : (
                    <button className="cat-name" onClick={() => setRenaming({ id: cat.id, name: cat.name })}>
                      {cat.name}
                      <small className="set-sub">{fa(countIn(cat.id))} قانون</small>
                    </button>
                  )}
                  <span className="cat-compare" title={STR.categories.compareToggle}>
                    <Toggle on={!!cat.compareEnabled} label={`${STR.categories.compareToggle} ${cat.name}`} onChange={(on) => void setCompareEnabled(cat, on)} />
                  </span>
                  <button className="icon-btn small" aria-label={`${STR.categories.moveUp} ${cat.name}`} disabled={i === 0} onClick={() => void moveCategory(categories, cat.id, -1)}>
                    <Icon name="chevronDown" size={17} stroke={2} />
                  </button>
                  <button className="icon-btn small" aria-label={`${STR.categories.moveDown} ${cat.name}`} disabled={i === categories.length - 1} onClick={() => void moveCategory(categories, cat.id, 1)}>
                    <Icon name="chevronDown" size={17} stroke={2} />
                  </button>
                  <button className="icon-btn small danger" aria-label={`${STR.feature.delete} ${cat.name}`} onClick={() => void remove(cat)}>
                    <Icon name="trash" size={16} stroke={2} />
                  </button>
                </div>
              ))}
            </div>

            <p className="hint cat-hint">{STR.categories.compareHint}</p>
            {err && <p className="form-error" role="alert">{err}</p>}
          </>
        )}

        {pending && (
          <>
            <p className="hint">{STR.categories.deleteAskWhere}</p>
            <p className="hint cat-count">{fa(countIn(pending.id))} قانون در این دسته</p>
            <div className="rf-row">
              <span className="tile blue" aria-hidden="true"><Icon name="tag" size={17} stroke={1.9} /></span>
              <span className="rf-name">{STR.categories.deleteMoveTo}</span>
              <span className="rf-value">
                {others.find((c) => c.id === target)?.name ?? '—'}
                <Choice
                  className="pick-hit"
                  label={STR.categories.deleteMoveTo}
                  value={target}
                  options={others.map((c): [string, string] => [c.id, c.name])}
                  onChange={setTarget}
                />
              </span>
            </div>
            <button
              className="primary"
              disabled={busy || !target}
              onClick={async () => { if (target) { await removeCategory(pending, rules.filter((r) => r.categoryId === pending.id), { moveTo: target }); setPending(null); } }}
            >
              <Icon name="undo" size={18} stroke={2.2} />{STR.categories.deleteMoveTo}
            </button>
            <button
              className="danger-btn"
              onClick={async () => { await removeCategory(pending, rules.filter((r) => r.categoryId === pending.id), { deleteRules: true }); setPending(null); }}
            >
              <Icon name="trash" size={16} stroke={2} />{STR.categories.deleteWithRules}
            </button>
          </>
        )}
      </section>
    </>
  );
}
