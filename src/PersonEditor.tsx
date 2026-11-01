import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Birthday, type Gender, type Person, db, del, put, uid } from './db';
import { BirthdayFields, type BirthdayDraft, draftOf, emptyDraft, readDraft, rowOf } from './BirthdayFields';
import { fa } from './cal';
import { personNameValid, splitPhones } from './phone';
import { pickOne } from './contacts';
import { ask } from './confirm';
import { Icon } from './Icon';
import { tk, tn, tx } from './i18n';
import { CIRCLES, circleDays, type Circle } from './circles';
import { Button, FormField, FormPage, FormSection, InputField, Select } from './ui';

const GENDERS: [Gender, string][] = [['f', tk('زن')], ['m', tk('مرد')], ['o', tk('دیگر')]];
const CADENCES = [7, 14, 30, 90, 180, 365];


export type PersonEdit = {
  person: Person;
  birthday?: Birthday;
};

/**
 * Modern ergonomic editor for person details: names, phones, work, location, and birthday.
 * Form is clearly categorized into sections with spacious touch-friendly vertical inputs.
 * Supports creating a new person (when data is omitted/null) or editing an existing one.
 */
export function PersonEditor({
  data,
  onClose,
  onSaved,
  onImportContacts,
}: {
  data?: PersonEdit | null;
  onClose: () => void;
  onSaved?: (personId: string) => void;
  onImportContacts?: () => void;
}) {
  const isNew = !data?.person;
  const p: Person = data?.person ?? {
    id: uid(),
    displayName: '',
    phones: [],
    emails: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const [displayNameTouched, setDisplayNameTouched] = useState(!isNew);
  const [f, setF] = useState(() => ({
    displayName: p.displayName || '',
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    nickname: p.nickname ?? '',
    gender: p.gender,
    cadenceDays: p.cadenceDays,
    circle: p.circle,
    city: p.city ?? '',
    occupation: p.occupation ?? '',
    workplace: p.workplace ?? '',
    phones: (p.phones ?? []).join(`${tx('،')} `),
    emails: (p.emails ?? []).join(`${tx('،')} `),
  }));
  const [bday, setBday] = useState<BirthdayDraft | null>(() => {
    if (data?.birthday) return draftOf(data.birthday);
    return null;
  });
  const [bdayOpen, setBdayOpen] = useState(!!data?.birthday);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

  /** Fill the empty form from one contact; the phone's picker needs no permission dialog. */
  const pickPerson = async () => {
    try {
      const pick = await pickOne();
      if (!pick) return;
      setDisplayNameTouched(true);
      set({
        displayName: [pick.given, pick.family].filter(Boolean).join(' ') || pick.phones[0] || '',
        firstName: pick.given ?? '',
        lastName: pick.family ?? '',
        phones: pick.phones.join(`${tx('،')} `),
        emails: pick.emails.join(`${tx('،')} `),
      });
    } catch {
      // no picker on the web build or the plugin refused; typing the name still works
    }
  };

  const people = useLiveQuery(() => db.people.toArray(), []) ?? [];
  const squeeze = (s: string) => s.replace(/\s+/g, ' ').trim().toLocaleLowerCase('fa');
  const cleanDisplayName = f.displayName.replace(/\s+/g, ' ').trim();
  const twin = cleanDisplayName
    ? people.find((item) => item.id !== p.id && !item.isSelf && !item.archivedAt && squeeze(item.displayName) === squeeze(cleanDisplayName))
    : undefined;

  const phones = splitPhones(f.phones);
  const badPhone = f.phones.trim() !== '' && phones.length === 0;
  const emails = f.emails.split(/[,\n،;؛]+/).map((e) => e.trim()).filter(Boolean);
  const bd = bday ? readDraft({ ...bday, name: f.displayName }) : null;
  const valid = personNameValid(f.displayName) && !badPhone && (!bday || !bd || bd.valid);

  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    const now = Date.now();
    const trim = (s: string) => s.trim() || undefined;
    try {
      const displayName = cleanDisplayName;
      const firstPhone = phones[0];
      const nextPerson: Person = {
        ...p,
        id: p.id || uid(),
        displayName,
        firstName: trim(f.firstName),
        lastName: trim(f.lastName),
        nickname: trim(f.nickname),
        gender: f.gender,
        cadenceDays: f.cadenceDays,
        circle: f.circle,
        city: trim(f.city),
        occupation: trim(f.occupation),
        workplace: trim(f.workplace),
        phones,
        emails,
        createdAt: p.createdAt || now,
        updatedAt: now,
      };
      for (const k of ['firstName', 'lastName', 'nickname', 'gender', 'cadenceDays', 'circle', 'city', 'occupation', 'workplace'] as const) {
        if (nextPerson[k] === undefined) delete nextPerson[k];
      }
      await put('people', nextPerson);

      if (bday && bd?.valid) {
        await put('birthdays', {
          ...rowOf(bday, data?.birthday),
          id: data?.birthday?.id ?? uid(),
          personId: nextPerson.id,
          name: displayName,
          phone: firstPhone,
        });
      } else if (data?.birthday && !bday) {
        await del('birthdays', data.birthday.id);
      }
      if (onSaved) {
        onSaved(nextPerson.id);
      } else {
        onClose();
      }
    } catch {
      setError(tx('ذخیره نشد؛ دوباره تلاش کن.'));
      setBusy(false);
    }
  };

  const clearBirthday = async () => {
    if (!data?.birthday) return;
    if (await ask({ title: tx('تولد حذف شود؟'), message: tx('تولد این فرد از یادآورها و صفحهٔ امروز هم پاک می‌شود.'), confirm: tx('حذف') })) {
      setBday(null);
      setBdayOpen(false);
    }
  };

  return (
    <FormPage
      title={isNew ? tx('افزودن فرد جدید') : tx('ویرایش مشخصات')}
      icon={isNew ? 'users' : 'edit'}
      onClose={onClose}
      onSave={save}
      saveLabel={isNew ? tx('ثبت') : tx('ذخیره')}
      saveDisabled={!valid}
      busy={busy}
      error={error}
    >
      {isNew && onImportContacts && (
        <FormSection>
          <button className="set-row as-btn" type="button" onClick={pickPerson}>
            <span className="tile purple" aria-hidden="true"><Icon name="smartphone" size={17} stroke={1.9} /></span>
            <span className="set-name">{tx('انتخاب از مخاطبین')}</span>
            <Icon name="chevronLeft" size={16} stroke={2} />
          </button>
          <button className="set-row as-btn" type="button" aria-haspopup="dialog" onClick={onImportContacts}>
            <span className="tile peach" aria-hidden="true"><Icon name="users" size={17} stroke={1.9} /></span>
            <span className="set-name">{tx('آوردن همهٔ مخاطبین')}</span>
            <Icon name="chevronLeft" size={16} stroke={2} />
          </button>
        </FormSection>
      )}

      <FormSection title={tx('مشخصات فردی و نام')} icon="users">
        <InputField
          label={tx('نام نمایشی')}
          required
          value={f.displayName}
          maxLength={80}
          onChange={(e) => {
            setDisplayNameTouched(true);
            set({ displayName: e.target.value });
          }}
          placeholder={tx('مثلاً علی رضایی')}
        />
        {twin && (
          <p className="pe-helper" style={{ color: 'var(--amber-ink, #d97706)' }}>
            «{twin.displayName}{tx('» از قبل در فهرست هست. اگر این فرد دیگری است، می‌توانید ثبتش کنید.')}</p>
        )}
        <InputField
          label={tx('نام')}
          value={f.firstName}
          maxLength={50}
          onChange={(e) => {
            const newFirst = e.target.value;
            if (!displayNameTouched && isNew) set({ firstName: newFirst, displayName: [newFirst, f.lastName].filter(Boolean).join(' ') });
            else set({ firstName: newFirst });
          }}
          placeholder={tx('نام کوچک')}
        />
        <InputField
          label={tx('نام خانوادگی')}
          value={f.lastName}
          maxLength={50}
          onChange={(e) => {
            const newLast = e.target.value;
            if (!displayNameTouched && isNew) set({ lastName: newLast, displayName: [f.firstName, newLast].filter(Boolean).join(' ') });
            else set({ lastName: newLast });
          }}
          placeholder={tx('نام خانوادگی')}
        />
        <InputField
          label={tx('نام مستعار یا لقب')}
          value={f.nickname}
          maxLength={60}
          onChange={(e) => set({ nickname: e.target.value })}
          placeholder={tx('مثلاً مهندس، عمو علی')}
        />
        <FormField label={tx('جنسیت')}>
          <div className="radios" role="radiogroup" aria-label={tx('جنسیت')}>
            {GENDERS.map(([g, n]) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={f.gender === g}
                className={f.gender === g ? 'on' : ''}
                onClick={() => set({ gender: f.gender === g ? undefined : g })}
              >{tx(n)}</button>
            ))}
          </div>
        </FormField>
      </FormSection>

      <FormSection title={tx('اطلاعات تماس')} icon="phone">
        <InputField
          label={tx('شماره تلفن‌ها')}
          type="tel"
          inputMode="tel"
          dir="ltr"
          value={f.phones}
          onChange={(e) => set({ phones: e.target.value })}
          placeholder={tx('0912...، 021...')}
          error={badPhone ? tx('شماره معتبر نیست. با رقم بنویسید و چند شماره را با «،» جدا کنید.') : undefined}
          hint={!badPhone && phones.length > 1 ? tn('{n} شماره با ویرگول (،) جدا شده‌اند.', phones.length) : undefined}
        />
        <InputField
          label={tx('آدرس ایمیل')}
          type="email"
          inputMode="email"
          dir="ltr"
          value={f.emails}
          onChange={(e) => set({ emails: e.target.value })}
          placeholder="name@example.com"
        />
      </FormSection>

      <FormSection title={tx('شغل و موقعیت')} icon="toolbox">
        <InputField
          label={tx('شغل / حرفه')}
          value={f.occupation}
          maxLength={60}
          onChange={(e) => set({ occupation: e.target.value })}
          placeholder={tx('مثلاً طراح، برنامه‌نویس')}
        />
        <InputField
          label={tx('شهر سکونت')}
          value={f.city}
          maxLength={50}
          onChange={(e) => set({ city: e.target.value })}
          placeholder={tx('مثلاً تهران')}
        />
        <InputField
          label={tx('محل کار یا سازمان')}
          value={f.workplace}
          maxLength={80}
          onChange={(e) => set({ workplace: e.target.value })}
          placeholder={tx('مثلاً نام شرکت یا سازمان')}
        />
      </FormSection>

      <FormSection title={tx('تاریخ تولد')} icon="cake">
        <div className="pe-birthday-toggle">
          <div>
            <b style={{ fontSize: '12.5px' }}>{tx('تنظیم تاریخ تولد')}</b>
            <p className="pe-helper" style={{ margin: 0 }}>{tx('یادآوری تولد و نمایش سن')}</p>
          </div>
          {!bdayOpen ? (
            <Button size="sm" icon="plus" onClick={() => { setBday(emptyDraft()); setBdayOpen(true); }}>{tx('افزودن')}</Button>
          ) : (
            <Button size="sm" onClick={() => { setBday(null); setBdayOpen(false); }}>{tx('برداشتن')}</Button>
          )}
        </div>

        {bdayOpen && bday && (
          <BirthdayFields d={bday} set={(patch) => setBday((x) => (x ? { ...x, ...patch } : x))} lockName />
        )}

        {data?.birthday && bdayOpen && (
          <Button variant="danger" block size="sm" onClick={clearBirthday}>
            {tx('حذف کامل تولد از یادآورها')}
          </Button>
        )}
      </FormSection>

      <FormSection title={tx('حفظ ارتباط')} icon="repeat">
        <Select
          label={tx('چقدر صمیمی است؟')}
          hint={tx('با انتخاب دسته، ریتم پیشنهادی پر می‌شود؛ می‌توانی عوضش کنی یا خالی بگذاری.')}
          value={f.circle ?? ''}
          onChange={(e) => {
            const circle = (e.target.value || undefined) as Circle | undefined;
            // fill the rhythm only while it is empty or still the old group's suggestion, so a hand-picked one is never overwritten
            const fresh = f.cadenceDays === undefined || f.cadenceDays === circleDays(f.circle);
            set({ circle, ...(fresh && { cadenceDays: circleDays(circle) }) });
          }}
          options={[{ value: '', label: tx('دسته‌بندی نشده') }, ...CIRCLES.map((c) => ({ value: c.key, label: tx(c.name) }))]}
        />
        <Select
          label={tx('هر چند وقت یک بار یادت بیندازد')}
          hint={tx('اگر بیشتر از این مدت تماسی با این فرد ثبت نشود، در «امروز» یادت می‌اندازد.')}
          value={f.cadenceDays ?? ''}
          onChange={(e) => set({ cadenceDays: e.target.value ? Number(e.target.value) : undefined })}
          options={[
            { value: '', label: tx('بدون یادآوری') },
            ...CADENCES.map((d) => ({ value: d, label: d === 365 ? tx('سالی یک بار') : tx('هر {a1} روز', { a1: fa(d) }) })),
          ]}
        />
      </FormSection>
    </FormPage>
  );
}
