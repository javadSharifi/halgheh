import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Exchange, type Interaction, type PersonNote, type RatingCriterion, db, del, put, uid } from './db';
import { fa } from './cal';
import { ask } from './confirm';
import { Icon } from './Icon';
import { primaryNote, personBundle } from './personData';
import { PersonEditor } from './PersonEditor';
import { InteractionForm } from './InteractionForm';
import { usePhotoUrls } from './usePhotoUrls';
import { SkillForm } from './SkillForm';
import { RatingForm } from './RatingForm';
import { RelationshipForm } from './RelationshipForm';
import { orderPersonSkills } from './skills';
import { orderExchanges, isSettled } from './domain/ledger';
import { TodoSheet } from './TodoSheet';
import { NewCheckSheet } from './PersonCheck';
import { ExchangeSheet } from './ledger/ExchangeSheet';
import { PersonHero } from './person/PersonHero';
import { OverviewTab } from './person/OverviewTab';
import { ActivityTab } from './person/ActivityTab';
import { EvaluationTab } from './person/EvaluationTab';
import { LedgerTab } from './person/LedgerTab';

export function PersonPage({ id, onBack, openCheck, openBrief, openLedger }: {
  id: string;
  onBack: () => void;
  /** Parts 2 and 4: the rule check and the pre-meeting brief, both opened as their own pages by `App`. */
  openCheck: (id: string) => void;
  openBrief: () => void;
  openLedger: () => void;
}) {
  const bundle = personBundle(id);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<'overview' | 'activity' | 'evaluation' | 'ledger'>('overview');
  const [interaction, setInteraction] = useState<Interaction | 'new' | null>(null);
  /** T2: null = closed, 'new' = a todo seeded with this person, otherwise the id of the todo being edited. */
  const [todoFor, setTodoFor] = useState<string | null>(null);
  /** R1: null = closed, 'new' = a skill being added, otherwise the id of the person-skill being edited. */
  const [skillFor, setSkillFor] = useState<string | null>(null);
  /** R2: which criterion's rating sheet is open, or null. */
  const [rateFor, setRateFor] = useState<RatingCriterion | null>(null);
  /** R3: null = closed, 'new' = a link being added, otherwise the link id being edited. */
  const [relFor, setRelFor] = useState<string | null>(null);
  /** Part 2: the "new check" sheet. Part 3: the exchange sheet, editing an existing one or creating one. */
  const [newCheck, setNewCheck] = useState(false);
  const [exchange, setExchange] = useState<Exchange | 'new' | null>(null);

  // Hooks must run on every render, so they sit above the early returns. A person's photos are device-local and only
  // needed once the bundle is there, but the hook itself has to be called unconditionally.
  const photoPaths = useMemo(() => new Map((bundle?.photoFiles ?? []).map((f) => [f.photoId, f.path])), [bundle?.photoFiles]);
  const photoUrls = usePhotoUrls(bundle?.photos ?? [], photoPaths);
  // Parts 2 and 3: this person's rule checks and their ledger, loaded here so the sections repaint on any save
  const checks = useLiveQuery(() => db.ruleChecks.where('personId').equals(id).toArray(), [id]) ?? [];
  const exchanges = useLiveQuery(() => db.exchanges.where('personId').equals(id).toArray(), [id]) ?? [];
  const settlements = useLiveQuery(() => db.exchangeSettlements.toArray(), []) ?? [];
  const allRules = useLiveQuery(() => db.rules.toArray(), []) ?? [];
  const checkItems = useLiveQuery(() => db.ruleCheckItems.toArray(), []) ?? [];

  if (bundle === undefined) return <p className="hint">…</p>;
  if (bundle === null) {
    return (
      <>
        <div className="page-head"><h1>پیدا نشد</h1></div>
        <p className="hint">این فرد پاک شده است.</p>
        <button onClick={onBack}>بازگشت</button>
      </>
    );
  }

  const { person: p, birthday: bd, notes, interactions, tags, tagLinks, askedTasks, askedDone, personSkills, skills, ratings, relationships, everyone, photos } = bundle;
  const mySkills = orderPersonSkills(personSkills, skills);
  const editingSkill = skillFor && skillFor !== 'new' ? mySkills.find((x) => x.id === skillFor) : undefined;
  const editingRel = relFor && relFor !== 'new' ? relationships.find((r) => r.id === relFor) : undefined;
  const note = primaryNote(notes);
  const openExchanges = orderExchanges(exchanges, settlements).filter((e) => !isSettled(e, settlements));

  const remove = async () => {
    if (!(await ask({
      title: `«${p.displayName}» حذف شود؟`,
      message: 'یادداشت‌ها، تعامل‌ها، برچسب‌ها و تولدِ او هم پاک می‌شوند. این کار قابل بازگشت نیست؛ اگر فقط نمی‌خواهی در فهرست باشد، بایگانی کن.',
      confirm: 'حذف',
      icon: 'trash',
    }))) return;
    // everything hanging off the person goes with them; the birthday row is theirs too (only the profile links one)
    for (const n of notes) await del('personNotes', n.id);
    for (const i of interactions) await del('interactions', i.id);
    for (const l of tagLinks) await del('personTags', l.id);
    if (bd) await del('birthdays', bd.id);
    await del('people', p.id);
    onBack();
  };
  const archive = async () => {
    const now = Date.now();
    await put('people', { ...p, archivedAt: now, updatedAt: now });
    onBack();
  };
  const saveNote = async (text: string) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!note && !clean) return;
    if (note && !clean) {
      await del('personNotes', note.id);
      return;
    }
    const row: PersonNote = { ...note, id: note?.id ?? uid(), personId: p.id, text: clean, updatedAt: Date.now() };
    await put('personNotes', row);
  };

  return (
    <>
      <header className="dd-head">
        <button className="icon-btn" aria-label="بازگشت" onClick={onBack}><Icon name="chevronRight" /></button>
        <span>پروفایل مخاطب</span>
        <button className="text-btn" aria-label="ویرایش پروفایل" onClick={() => setEditing(true)}>
          <Icon name="edit" size={16} stroke={2.2} />
          <span>ویرایش</span>
        </button>
      </header>

      <PersonHero person={p} onEdit={() => setEditing(true)} openBrief={openBrief} />

      {/* نوار دسته‌بندی تب‌ها */}
      <div className="profile-tabs" role="tablist" aria-label="دسته‌بندی‌های پروفایل">
        <button
          role="tab"
          aria-selected={tab === 'overview'}
          className={`pt-tab${tab === 'overview' ? ' active' : ''}`}
          onClick={() => setTab('overview')}
        >
          <span>اطلاعات</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'activity'}
          className={`pt-tab${tab === 'activity' ? ' active' : ''}`}
          onClick={() => setTab('activity')}
        >
          <span>فعالیت</span>
          {(askedTasks.length + interactions.length) > 0 && (
            <span className="pt-badge">{fa(askedTasks.length + interactions.length)}</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'evaluation'}
          className={`pt-tab${tab === 'evaluation' ? ' active' : ''}`}
          onClick={() => setTab('evaluation')}
        >
          <span>ارزیابی</span>
          {(mySkills.length + checks.length) > 0 && (
            <span className="pt-badge">{fa(mySkills.length + checks.length)}</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'ledger'}
          className={`pt-tab${tab === 'ledger' ? ' active' : ''}`}
          onClick={() => setTab('ledger')}
        >
          <span>مالی و عکس</span>
          {(openExchanges.length + photos.length) > 0 && (
            <span className="pt-badge">{fa(openExchanges.length + photos.length)}</span>
          )}
        </button>
      </div>

      {tab === 'overview' && (
        <OverviewTab
          person={p}
          birthday={bd}
          note={note}
          tags={tags}
          tagLinks={tagLinks}
          onEdit={() => setEditing(true)}
          onSaveNote={saveNote}
          onArchive={archive}
          onRemove={remove}
        />
      )}

      {tab === 'activity' && (
        <ActivityTab
          askedTasks={askedTasks}
          askedDone={askedDone}
          interactions={interactions}
          onTodo={setTodoFor}
          onInteraction={setInteraction}
        />
      )}

      {tab === 'evaluation' && (
        <EvaluationTab
          personId={p.id}
          personSkills={personSkills}
          skills={skills}
          ratings={ratings}
          relationships={relationships}
          everyone={everyone}
          checks={checks}
          allRules={allRules}
          checkItems={checkItems}
          onRate={setRateFor}
          onSkill={setSkillFor}
          onRel={setRelFor}
          onNewCheck={() => setNewCheck(true)}
          openCheck={openCheck}
        />
      )}

      {tab === 'ledger' && (
        <LedgerTab
          personId={p.id}
          exchanges={exchanges}
          settlements={settlements}
          photos={photos}
          photoUrls={photoUrls}
          openLedger={openLedger}
          openBrief={openBrief}
          onExchange={setExchange}
        />
      )}

      {editing && <PersonEditor data={{ person: p, birthday: bd }} onClose={() => setEditing(false)} />}
      {relFor && (
        <RelationshipForm
          key={relFor}
          personId={p.id}
          people={everyone}
          links={relationships}
          editing={editingRel}
          onClose={() => setRelFor(null)}
        />
      )}
      {rateFor && (
        <RatingForm
          key={rateFor}
          personId={p.id}
          criterion={rateFor}
          ratings={ratings}
          onClose={() => setRateFor(null)}
        />
      )}
      {skillFor && (
        <SkillForm
          key={skillFor}
          personId={p.id}
          skills={skills}
          existing={personSkills}
          initial={editingSkill}
          onClose={() => setSkillFor(null)}
        />
      )}
      {todoFor && (
        <TodoSheet
          key={todoFor}
          id={todoFor === 'new' ? null : todoFor}
          seedPersonId={p.id}
          onClose={() => setTodoFor(null)}
        />
      )}
      {newCheck && (
        <NewCheckSheet
          personId={p.id}
          onClose={() => setNewCheck(false)}
          onCreated={(cid) => { setNewCheck(false); openCheck(cid); }}
        />
      )}
      {exchange && (
        <ExchangeSheet
          key={exchange === 'new' ? 'new' : exchange.id}
          people={everyone.filter((x) => !x.archivedAt && !x.isSelf)}
          seedPersonId={p.id}
          exchange={exchange === 'new' ? null : exchange}
          onClose={() => setExchange(null)}
        />
      )}
      {interaction && (
        <InteractionForm
          key={interaction === 'new' ? 'new' : interaction.id}
          personId={p.id}
          initial={interaction === 'new' ? undefined : interaction}
          onClose={() => setInteraction(null)}
        />
      )}
    </>
  );
}
