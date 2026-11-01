import { useMemo, useState } from 'react';
import { type PersonSkill, type Skill, del, put, uid } from './db';
import { today } from './cal';
import { ask } from './confirm';
import { Icon } from './Icon';
import { DatePicker } from './DatePicker';
import { Choice } from './Choice';
import { EVIDENCE_STATUS, findSkill, readSkillNumbers, STATUS_LABEL } from './skills';
import { tx } from './i18n';
import { FormPage, FormSection, InputField } from './ui';

/** The status picker's labels, ordered strongest first. */
const STATUS: [PersonSkill['evidenceStatus'], string][] = [...EVIDENCE_STATUS].map(([k, v]) => [k, v] as const);

/**
 * Add or edit one skill of one person (R1). A typed name that matches an existing skill (or alias) links to it; anything
 * else creates a skill in the shared vocabulary, optionally under a parent, so "مکانیک خودرو" can sit under "مکانیک".
 */
export function SkillForm({ personId, skills, existing, initial, onClose }: {
  personId: string;
  skills: Skill[];
  existing: PersonSkill[];
  initial?: PersonSkill;
  onClose: () => void;
}) {
  const [v, setV] = useState(() => ({
    name: initial ? skills.find((s) => s.id === initial.skillId)?.name ?? '' : '',
    parentName: initial ? skills.find((s) => s.id === skills.find((x) => x.id === initial.skillId)?.parentId)?.name ?? '' : '',
    aliases: initial ? (skills.find((s) => s.id === initial.skillId)?.aliases ?? []).join(`${tx('،')} `) : '',
    level: initial?.level !== undefined ? String(initial.level) : '',
    years: initial?.years !== undefined ? String(initial.years) : '',
    evidence: initial?.evidence ?? '',
    status: initial?.evidenceStatus ?? ('claimed' as PersonSkill['evidenceStatus']),
    verified: initial?.lastVerifiedAt ?? today(),
    hasVerified: !!initial?.lastVerifiedAt,
  }));
  const [picking, setPicking] = useState<'verified' | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));

  const match = useMemo(() => findSkill(skills, v.name), [skills, v.name]);
  const already = useMemo(() => (match ? existing.find((e) => e.skillId === match.id) : undefined), [match, existing]);
  const clash = !!already && already.id !== initial?.id; // this person already has that skill on another row
  const nums = readSkillNumbers(v.level, v.years);
  const valid = v.name.trim() !== '' && nums.valid && (v.aliases.trim() === '' || true);
  const creating = !match && v.name.trim() !== '';

  const save = async () => {
    if (!valid || busy || clash) return;
    setBusy(true);
    setErr('');
    try {
      let skillId = match?.id;
      if (creating) {
        // the vocabulary gets the new skill once; the alias text is stored on it so search can find both names later
        const parent = v.parentName.trim() ? findSkill(skills, v.parentName) : undefined;
        const row: Skill = {
          id: uid(),
          name: v.name.replace(/\s+/g, ' ').trim(),
          aliases: v.aliases.split(/[,\n،;؛]+/).map((a) => a.replace(/\s+/g, ' ').trim()).filter(Boolean),
          parentId: parent?.id,
          updatedAt: Date.now(),
        };
        if (!row.parentId) delete row.parentId;
        if (!row.aliases.length) row.aliases = [];
        await put('skills', row);
        skillId = row.id;
      } else if (match && v.aliases.trim()) {
        // editing the alias list of an existing skill is allowed here; it makes search better for everyone
        const aliases = v.aliases.split(/[,\n،;؛]+/).map((a) => a.replace(/\s+/g, ' ').trim()).filter(Boolean);
        if (aliases.join('|') !== match.aliases.join('|')) await put('skills', { ...match, aliases, updatedAt: Date.now() });
      }
      if (!skillId) return;
      const row: PersonSkill = {
        ...initial,
        id: initial?.id ?? `${personId}|${skillId}`,
        personId,
        skillId,
        evidenceStatus: v.status,
        updatedAt: Date.now(),
      };
      if (nums.level !== undefined) row.level = nums.level;
      else delete row.level;
      if (nums.years !== undefined) row.years = nums.years;
      else delete row.years;
      if (v.evidence.trim()) row.evidence = v.evidence.replace(/\s+/g, ' ').trim();
      else delete row.evidence;
      if (v.hasVerified) row.lastVerifiedAt = v.verified;
      else delete row.lastVerifiedAt;
      await put('personSkills', row);
      onClose();
    } catch {
      setErr(tx('ذخیره نشد؛ دوباره تلاش کن.'));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    if (!(await ask({ title: tx('این مهارت حذف شود؟'), message: tx('فقط برای همین فرد پاک می‌شود؛ مهارت در فهرست کلی می‌ماند.'), confirm: tx('حذف') }))) return;
    await del('personSkills', initial.id);
    onClose();
  };

  return (
    <>
      <FormPage
        title={initial ? tx('ویرایش مهارت') : tx('مهارت تازه')}
        icon={initial ? 'edit' : 'plus'}
        onClose={onClose}
        onSave={() => void save()}
        saveLabel={initial ? tx('ذخیره') : tx('ثبت')}
        saveDisabled={!valid || clash}
        busy={busy}
        error={err}
        onDelete={initial ? () => void remove() : undefined}
        deleteLabel={tx('حذف این مهارت')}
      >
        <FormSection>
          <InputField
            label={tx('مهارت')}
            autoFocus
            value={v.name}
            maxLength={60}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={tx('مثلاً مکانیک خودرو')}
          />
          {match && (
            <p className="hint pe-hint" role="status">
              <Icon name="checkCircle" size={13} stroke={2} /> «{match.name}{tx('» از قبل در فهرست مهارت‌ها هست و به همان وصل می‌شود.')}</p>
          )}
          {creating && <p className="hint pe-hint">«{v.name.trim()}{tx('» به فهرست مهارت‌ها اضافه می‌شود.')}</p>}
          {clash && <p className="form-error" role="alert">{tx('این مهارت برای این فرد ثبت شده است.')}</p>}

          <InputField
            label={tx('زیرشاخهٔ (اختیاری)')}
            value={v.parentName}
            maxLength={60}
            onChange={(e) => set({ parentName: e.target.value })}
            placeholder={tx('مثلاً مکانیک')}
          />
          {creating && (
            <InputField
              label={tx('نام‌های دیگر (اختیاری)')}
              value={v.aliases}
              onChange={(e) => set({ aliases: e.target.value })}
              placeholder={tx('با «،» جدا کن')}
            />
          )}

          <InputField
            label={tx('سطح (۱–۵)')}
            inputMode="numeric"
            value={v.level}
            onChange={(e) => set({ level: e.target.value })}
            error={!nums.levelOk ? tx('سطح باید عددی بین ۱ و ۵ باشد.') : undefined}
          />
          <InputField
            label={tx('سال تجربه')}
            inputMode="numeric"
            value={v.years}
            onChange={(e) => set({ years: e.target.value })}
            error={!nums.yearsOk ? tx('سال تجربه باید عددی بین ۰ و ۷۰ باشد.') : undefined}
          />

          <div className="rf-row">
            <span className="tile purple" aria-hidden="true"><Icon name="target" size={17} stroke={1.9} /></span>
            <span className="rf-name">{tx('شواهد')}</span>
            <span className="rf-value">
              {tx(STATUS_LABEL[v.status])}
              <Icon name="chevronLeft" size={16} stroke={2} />
              <Choice className="pick-hit" label={tx('وضعیت شواهد')} value={v.status} options={STATUS} onChange={(s) => set({ status: s })} />
            </span>
          </div>

          <InputField
            label={tx('چه چیزی دیدی (اختیاری)')}
            multiline
            rows={3}
            value={v.evidence}
            onChange={(e) => set({ evidence: e.target.value })}
            placeholder={tx('مثلاً موتور پراید را خودش تعمیر کرد')}
            maxLength={600}
          />

          <div className="rf-row">
            <span className="tile green" aria-hidden="true"><Icon name="checkCircle" size={17} stroke={1.9} /></span>
            <span className="rf-name">{tx('آخرین تأیید')}</span>
            <button type="button" className="rf-value as-text" onClick={() => setPicking('verified')}>
              {v.hasVerified ? v.verified : tx('ثبت نشده')}
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
            {v.hasVerified ? (
              <button type="button" className="mini-btn" onClick={() => set({ verified: today(), hasVerified: true })}>{tx('امروز')}</button>
            ) : (
              <button type="button" className="mini-btn" onClick={() => set({ verified: today(), hasVerified: true })}>{tx('تأیید')}</button>
            )}
          </div>
          <p className="hint pe-hint">{tx('اگر بیش از ۱۲ ماه تأیید نشود، کهنه علامت می‌خورد.')}</p>

        </FormSection>
      </FormPage>
      {picking === 'verified' && (
        <DatePicker value={v.verified} onPick={(d) => { set({ verified: d, hasVerified: true }); setPicking(null); }} onClose={() => setPicking(null)} />
      )}
    </>
  );
}
