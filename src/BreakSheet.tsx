import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Person, type Rule, type RuleBreak, db } from './db';
import { fa, label, today } from './cal';
import { Icon } from './Icon';
import { Choice } from './Choice';
import { DatePicker } from './DatePicker';
import { ask } from './confirm';
import { STR } from './strings/rulebook';
import { createBreak, deleteBreak } from './ruleData';
import { breakCounts } from './domain/rules/breaks';
import { tx } from './i18n';
import { personLabel } from './format';

/**
 * Part 1: record one time I broke a rule. Reached from the review session (the «یادم بود ولی رعایت نکردم» answer), from a
 * rule's detail sheet, and from a rule check that marked a rule as breaking.
 *
 * Every field is optional on purpose: "بعداً" still creates the `ruleBreaks` row, so a break is never lost just because the
 * user did not feel like writing at that moment. The row is created **once** when the sheet is first saved or skipped, and
 * the same sheet then edits that row — never a second one.
 */
export function BreakSheet({ rule, seedPersonId, onClose, onSaved }: {
  rule: Rule;
  /** Set when the sheet is opened from a person's checker, so the link is made without asking twice. */
  seedPersonId?: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const [v, setV] = useState(() => ({
    brokenOn: today(),
    personId: seedPersonId ?? '',
    whatHappened: '',
    whyBroke: '',
    nextTimePlan: '',
  }));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const personName = (id: string) => people.find((p) => p.id === id)?.displayName;
  const live = useMemo(() => people.filter((p) => !p.archivedAt && !p.isSelf), [people]);

  const save = async (skip: boolean) => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      await createBreak(rule.id, skip ? {} : { ...v, personId: v.personId || undefined });
      onSaved?.();
      onClose();
    } catch {
      setErr(tx(STR.feature.saveFailed));
      setBusy(false);
    }
  };

  return (
    <>
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet break-sheet" role="dialog" aria-modal="true" aria-labelledby="break-title">
        <div className="bf-head">
          <span id="break-title">{tx(STR.breaks.sheetTitleFor(rule.title))}</span>
          <button className="text-btn" onClick={onClose}>{tx(STR.feature.close)}</button>
        </div>

        <div className="pe-scroll">
          <label className="bf-name bf-name-top">
            <span>{tx(STR.breaks.whatHappened)}</span>
            <textarea className="rf-text" value={v.whatHappened} maxLength={2000} onChange={(e) => set({ whatHappened: e.target.value })} />
          </label>

          <label className="bf-name bf-name-top">
            <span>{tx(STR.breaks.whyBroke)}</span>
            <textarea className="rf-text" value={v.whyBroke} maxLength={2000} onChange={(e) => set({ whyBroke: e.target.value })} />
          </label>

          <label className="bf-name bf-name-top">
            <span>{tx(STR.breaks.nextTimePlan)}</span>
            <textarea className="rf-text" value={v.nextTimePlan} maxLength={2000} onChange={(e) => set({ nextTimePlan: e.target.value })} />
          </label>

          <div className="rf-row">
            <span className="tile blue" aria-hidden="true"><Icon name="calendar" size={17} stroke={1.9} /></span>
            <span className="rf-name">{tx(STR.breaks.brokenOn)}</span>
            <button type="button" className="rf-value as-text" onClick={() => setPicking(true)}>
              {label(v.brokenOn, 'persian', 0, { day: 'numeric', month: 'long', year: 'numeric' })}
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          </div>

          <div className="rf-row">
            <span className="tile purple" aria-hidden="true"><Icon name="users" size={17} stroke={1.9} /></span>
            <span className="rf-name">{tx(STR.breaks.person)}</span>
            <span className="rf-value">
              {v.personId ? (personName(v.personId) ?? '…') : tx(STR.breaks.personNone)}
              <Choice
                className="pick-hit"
                label={tx(STR.breaks.person)}
                value={v.personId}
                options={[['', tx(STR.breaks.personNone)], ...live.map((p: Person): [string, string] => [p.id, personLabel(p)])]}
                onChange={(id) => set({ personId: id })}
              />
            </span>
          </div>

          {err && <p className="form-error" role="alert">{err}</p>}
        </div>

        <button className="primary" disabled={busy} onClick={() => void save(false)}>
          <Icon name="check" size={18} stroke={2.4} />{busy ? tx('در حال ذخیره…') : tx(STR.breaks.save)}
        </button>
        <button className="big-btn break-later" disabled={busy} onClick={() => void save(true)}>
          <Icon name="clock" size={17} stroke={1.9} />{tx(STR.breaks.later)}
        </button>
        <p className="hint break-hint">{tx(STR.breaks.savedEmpty)}</p>
      </section>
      {picking && <DatePicker value={v.brokenOn} onPick={(d) => { set({ brokenOn: d }); setPicking(false); }} onClose={() => setPicking(false)} />}
    </>
  );
}

/**
 * The break timeline on a rule's detail sheet: the counts for the three periods, then every break with its texts, date,
 * person link, edit and confirmed delete.
 */
export function BreakTimeline({ rule, breaks, onEdit, todayIso }: {
  rule: Rule;
  breaks: RuleBreak[];
  onEdit: (b: RuleBreak) => void;
  todayIso: string;
}) {
  const [open, setOpen] = useState(false);
  const counts = breakCounts(breaks, rule.id, todayIso);

  const remove = async (b: RuleBreak) => {
    if (!(await ask({ title: tx(STR.breaks.deleteTitle), message: tx(STR.breaks.deleteBody), confirm: tx(STR.feature.delete), icon: 'trash' }))) return;
    await deleteBreak(b);
  };

  return (
    <>
      <div className="rf-row break-counts-row">
        <span className="tile peach" aria-hidden="true"><Icon name="close" size={17} stroke={2.2} /></span>
        <span className="rf-name">
          {tx(STR.breaks.counts)}
          <small className="set-sub">
            {tx(STR.breaks.d30)}: {fa(counts.d30)} · {tx(STR.breaks.d90)}: {fa(counts.d90)} · {tx(STR.breaks.allTime)}: {fa(counts.all)}
          </small>
        </span>
        <button type="button" className="text-btn" onClick={() => setOpen((x) => !x)} aria-expanded={open}>
          {tx(STR.breaks.timeline)}
        </button>
      </div>

      {open && (
        <div className="rule-history break-timeline">
          {breaks.length === 0 && <p className="hint">{tx(STR.breaks.timelineEmpty)}</p>}
          {breaks.map((b) => (
            <div key={b.id} className="break-row">
              <div className="break-head">
                <b>{label(b.brokenOn, 'persian', 0, { day: 'numeric', month: 'long', year: 'numeric' })}</b>
                <span className="break-actions">
                  <button className="icon-btn small" aria-label={tx(STR.breaks.editTitle)} onClick={() => onEdit(b)}>
                    <Icon name="note" size={15} stroke={1.9} />
                  </button>
                  <button className="icon-btn small danger" aria-label={`${tx(STR.feature.delete)}: ${b.brokenOn}`} onClick={() => void remove(b)}>
                    <Icon name="trash" size={15} stroke={2} />
                  </button>
                </span>
              </div>
              {b.whatHappened && <p className="break-text">{b.whatHappened}</p>}
              {b.whyBroke && <p className="break-text break-why"><span className="field-label">{tx(STR.breaks.whyBroke)}:</span> {b.whyBroke}</p>}
              {b.nextTimePlan && <p className="break-text break-plan"><span className="field-label">{tx(STR.breaks.nextTimePlan)}:</span> {b.nextTimePlan}</p>}
              {b.personId && <BreakPerson personId={b.personId} />}
              {/* the rule is only here so the counts above and the rows below read as one thing */}
              <span className="sr-only">{rule.title}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function BreakPerson({ personId }: { personId: string }) {
  const person = useLiveQuery(() => db.people.get(personId), [personId]);
  if (!person) return null;
  return <p className="break-person"><Icon name="users" size={12} stroke={2} />{personLabel(person)}</p>;
}
