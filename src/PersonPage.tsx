import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Exchange, type Interaction, type Photo, type PersonNote, type RatingCriterion, db, del, put, uid } from './db';
import { fa } from './cal';
import { ask } from './confirm';
import { Icon, type IconName } from './Icon';
import { primaryNote, personBundle } from './personData';
import { PersonEditor } from './PersonEditor';
import { InteractionForm } from './InteractionForm';
import { usePhotoUrls } from './usePhotoUrls';
import { usePhotoAdd } from './photoAdd';
import { PhotoViewer } from './PhotoViewer';
import { PhotoEdit } from './PhotoEdit';
import { removePhoto } from './storePhoto';
import { isNative } from './native';
import { SkillForm } from './SkillForm';
import { RatingForm } from './RatingForm';
import { RelationshipForm } from './RelationshipForm';
import { orderPersonSkills } from './skills';
import { orderExchanges, isSettled } from './domain/ledger';
import { TodoSheet } from './TodoSheet';
import { NewCheckSheet } from './PersonCheck';
import { PersonHero } from './person/PersonHero';
import { OverviewTab } from './person/OverviewTab';
import { ActivityTab } from './person/ActivityTab';
import { EvaluationTab } from './person/EvaluationTab';
import { LedgerTab } from './person/LedgerTab';
import { tk, tx } from './i18n';

export function PersonPage({ id, onBack, openCheck, openBrief, openLedger, openExchange }: {
  id: string;
  onBack: () => void;
  /** Parts 2 and 4: the rule check and the pre-meeting brief, both opened as their own pages by `App`. */
  openCheck: (id: string) => void;
  openBrief: () => void;
  openLedger: () => void;
  openExchange: (seedPersonId?: string, exchangeId?: string | null) => void;
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

  // Hooks must run on every render, so they sit above the early returns. A person's photos are device-local and only
  // needed once the bundle is there, but the hook itself has to be called unconditionally.
  const photoAdd = usePhotoAdd(id);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const photoPaths = useMemo(() => new Map((bundle?.photoFiles ?? []).map((f) => [f.photoId, f.path])), [bundle?.photoFiles]);
  const { thumb: photoUrls, full: photoFull } = usePhotoUrls(bundle?.photos ?? [], photoPaths);
  // Parts 2 and 3: this person's rule checks and their ledger, loaded here so the sections repaint on any save.
  // Settlements and check items are read through this person's own rows, so the global history never loads.
  const checks = useLiveQuery(() => db.ruleChecks.where('personId').equals(id).toArray(), [id]) ?? [];
  const exchanges = useLiveQuery(() => db.exchanges.where('personId').equals(id).toArray(), [id]) ?? [];
  const settlements = useLiveQuery(async () => {
    const ids = exchanges.map((e) => e.id);
    return ids.length ? db.exchangeSettlements.where('exchangeId').anyOf(ids).toArray() : [];
  }, [exchanges]) ?? [];
  const allRules = useLiveQuery(() => db.rules.toArray(), []) ?? [];
  const checkItems = useLiveQuery(async () => {
    const ids = checks.map((c) => c.id);
    return ids.length ? db.ruleCheckItems.where('checkId').anyOf(ids).toArray() : [];
  }, [checks]) ?? [];

  if (bundle === undefined) return <p className="hint">…</p>;
  if (bundle === null) {
    return (
      <>
        <div className="page-head"><h1>{tx('پیدا نشد')}</h1></div>
        <p className="hint">{tx('این فرد پاک شده است.')}</p>
        <button onClick={onBack}>{tx('بازگشت')}</button>
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
      title: tx('«{a1}» حذف شود؟', { a1: p.displayName }),
      message: tx('یادداشت‌ها، تعامل‌ها، برچسب‌ها و تولدِ او هم پاک می‌شوند. این کار قابل بازگشت نیست؛ اگر فقط نمی‌خواهی در فهرست باشد، بایگانی کن.'),
      confirm: tx('حذف'),
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

  const sections: { key: typeof tab; icon: IconName; name: string; hint: string; count: number }[] = [
    { key: 'overview', icon: 'info', name: tk('اطلاعات'), hint: tk('شماره، ایمیل، تولد، برچسب‌ها و یادداشت'), count: 0 },
    { key: 'activity', icon: 'history', name: tk('فعالیت'), hint: tk('تعامل‌ها و کارهایی که این فرد از تو خواسته'), count: askedTasks.length + interactions.length },
    { key: 'evaluation', icon: 'target', name: tk('ارزیابی'), hint: tk('امتیازها، مهارت‌ها، رابطه‌ها و بررسی قوانین'), count: mySkills.length + checks.length },
    { key: 'ledger', icon: 'repeat', name: tk('مالی و عکس'), hint: tk('دادوستدها، خلاصهٔ قبل از قرار و عکس‌ها'), count: openExchanges.length + photos.length },
  ];

  return (
    <>
      <header className="dd-head">
        <button className="icon-btn" aria-label={tx('بازگشت')} onClick={onBack}><Icon name="chevronRight" /></button>
        <span>{tx('پروفایل مخاطب')}</span>
        <button className="text-btn" aria-label={tx('ویرایش پروفایل')} onClick={() => setEditing(true)}>
          <Icon name="edit" size={16} stroke={2.2} />
          <span>{tx('ویرایش')}</span>
        </button>
      </header>

      <PersonHero person={p} onEdit={() => setEditing(true)} openBrief={openBrief} onInteraction={() => setInteraction('new')} onExchange={() => openExchange(p.id, null)} />

      {/* Section switcher: every section gets its own icon and a one-line description, so none looks hidden */}
      <div className="profile-tabs" role="tablist" aria-label={tx('دسته‌بندی‌های پروفایل')}>
        {sections.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`pt-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <Icon name={t.icon} size={17} stroke={1.9} />
            <span>{tx(t.name)}</span>
            {t.count > 0 && <span className="pt-badge">{fa(t.count)}</span>}
          </button>
        ))}
      </div>
      <p className="pt-hint">{tx(sections.find((t) => t.key === tab)?.hint ?? '')}</p>

      {tab === 'overview' && (
        <OverviewTab
          person={p}
          birthday={bd}
          interactions={interactions}
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
          onOpenPhoto={setViewingPhoto}
          onAddPhoto={isNative ? () => void photoAdd.start() : undefined}
          openLedger={openLedger}
          openBrief={openBrief}
          onExchange={(ex) => openExchange(p.id, ex === 'new' ? null : ex.id)}
        />
      )}

      {photoAdd.form}
      {viewingPhoto && (
        <PhotoViewer
          photoId={viewingPhoto}
          photos={photos}
          urls={photoFull}
          title={(pid) => photos.find((x) => x.id === pid)?.title ?? ''}
          onClose={() => setViewingPhoto(null)}
          onEdit={(ph) => { setViewingPhoto(null); setEditingPhoto(ph); }}
          onRemove={(ph) => void removePhoto(ph).then((gone) => gone && setViewingPhoto(null))}
          onNavigate={setViewingPhoto}
        />
      )}
      {editingPhoto && <PhotoEdit key={editingPhoto.id} photo={editingPhoto} onClose={() => setEditingPhoto(null)} />}
      {photoAdd.err && <p className="form-error" role="alert">{photoAdd.err}</p>}
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
