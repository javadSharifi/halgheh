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
import { Button, Select } from './ui';

const GENDERS: [Gender, string][] = [['f', tk('زن')], ['m', tk('مرد')], ['o', tk('دیگر')]];
const CADENCES = [7, 30, 90, 180];


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
  asPage,
}: {
  data?: PersonEdit | null;
  onClose: () => void;
  onSaved?: (personId: string) => void;
  onImportContacts?: () => void;
  /** Renders as a full screen page instead of a bottom sheet. */
  asPage?: boolean;
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
        city: trim(f.city),
        occupation: trim(f.occupation),
        workplace: trim(f.workplace),
        phones,
        emails,
        createdAt: p.createdAt || now,
        updatedAt: now,
      };
      for (const k of ['firstName', 'lastName', 'nickname', 'gender', 'cadenceDays', 'city', 'occupation', 'workplace'] as const) {
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

  const onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.target;
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  return (
    <>
      {!asPage && <div className="scrim dim" onClick={onClose} />}
      <section className={asPage ? 'pe-page' : 'sheet person-editor-sheet'} role={asPage ? undefined : 'dialog'} aria-modal={asPage ? undefined : true} aria-labelledby="person-editor-title">
        <header className="pe-header">
          <button className="pe-header-action close" type="button" onClick={onClose}>
            {asPage ? <Icon name="chevronRight" size={16} stroke={2.2} /> : tx('انصراف')}
          </button>
          <div className="pe-header-title">
            <Icon name={isNew ? 'users' : 'edit'} size={17} />
            <span id="person-editor-title">{isNew ? tx('افزودن فرد جدید') : tx('ویرایش مشخصات')}</span>
          </div>
          <button
            className="primary pe-header-action save"
            type="button"
            disabled={!valid || busy}
            onClick={save}
          >
            <Icon name="check" size={15} stroke={2.5} />
            <span>{busy ? '…' : isNew ? tx('ثبت') : tx('ذخیره')}</span>
          </button>
        </header>

        <div className="pe-content">
          {error && <p className="pe-error-text" role="alert">{error}</p>}

          {isNew && onImportContacts && (
            <>
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
            </>
          )}

          {/* بخش ۱: مشخصات فردی */}
          <div className="pe-section">
            <div className="pe-section-title">
              <Icon name="users" size={16} />
              <span>{tx('مشخصات فردی و نام')}</span>
            </div>

            <div className={`pe-field${!personNameValid(f.displayName) && f.displayName.trim() ? ' has-error' : ''}`}>
              <label className="pe-label">
                <span>{tx('نام نمایشی')}</span>
                <span className="req">{tx('* اجباری')}</span>
              </label>
              <input
                className="pe-input"
                value={f.displayName}
                maxLength={80}
                onFocus={onInputFocus}
                onChange={(e) => {
                  setDisplayNameTouched(true);
                  set({ displayName: e.target.value });
                }}
                placeholder={tx('مثلاً علی رضایی')}
              />
              {twin && (
                <p className="pe-helper" style={{ color: 'var(--amber-ink, #d97706)', marginTop: '4px' }}>
                  «{twin.displayName}{tx('» از قبل در فهرست هست. اگر این فرد دیگری است، می‌توانید ثبتش کنید.')}</p>
              )}
            </div>

            <div className="pe-grid-2">
              <div className="pe-field">
                <label className="pe-label"><span>{tx('نام')}</span></label>
                <input
                  className="pe-input"
                  value={f.firstName}
                  maxLength={50}
                  onFocus={onInputFocus}
                  onChange={(e) => {
                    const newFirst = e.target.value;
                    if (!displayNameTouched && isNew) {
                      const combined = [newFirst, f.lastName].filter(Boolean).join(' ');
                      set({ firstName: newFirst, displayName: combined });
                    } else {
                      set({ firstName: newFirst });
                    }
                  }}
                  placeholder={tx('نام کوچک')}
                />
              </div>
              <div className="pe-field">
                <label className="pe-label"><span>{tx('نام خانوادگی')}</span></label>
                <input
                  className="pe-input"
                  value={f.lastName}
                  maxLength={50}
                  onFocus={onInputFocus}
                  onChange={(e) => {
                    const newLast = e.target.value;
                    if (!displayNameTouched && isNew) {
                      const combined = [f.firstName, newLast].filter(Boolean).join(' ');
                      set({ lastName: newLast, displayName: combined });
                    } else {
                      set({ lastName: newLast });
                    }
                  }}
                  placeholder={tx('نام خانوادگی')}
                />
              </div>
            </div>

            <div className="pe-field">
              <label className="pe-label"><span>{tx('نام مستعار یا لقب')}</span></label>
              <input
                className="pe-input"
                value={f.nickname}
                maxLength={60}
                onFocus={onInputFocus}
                onChange={(e) => set({ nickname: e.target.value })}
                placeholder={tx('مثلاً مهندس، عمو علی')}
              />
            </div>

            <div className="pe-field">
              <label className="pe-label"><span>{tx('جنسیت')}</span></label>
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
            </div>
          </div>

          {/* بخش ۲: ارتباط و تماس */}
          <div className="pe-section">
            <div className="pe-section-title">
              <Icon name="phone" size={16} />
              <span>{tx('اطلاعات تماس')}</span>
            </div>

            <div className={`pe-field${badPhone ? ' has-error' : ''}`}>
              <label className="pe-label"><span>{tx('شماره تلفن‌ها')}</span></label>
              <input
                className="pe-input"
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={f.phones}
                onFocus={onInputFocus}
                onChange={(e) => set({ phones: e.target.value })}
                placeholder={tx('0912...، 021...')}
              />
              {badPhone ? (
                <p className="pe-error-text">{tx('شماره معتبر نیست. با رقم بنویسید و چند شماره را با «،» جدا کنید.')}</p>
              ) : phones.length > 1 ? (
                <span className="pe-helper">{tn('{n} شماره با ویرگول (،) جدا شده‌اند.', phones.length)}</span>
              ) : null}
            </div>

            <div className="pe-field">
              <label className="pe-label"><span>{tx('آدرس ایمیل')}</span></label>
              <input
                className="pe-input"
                type="email"
                inputMode="email"
                dir="ltr"
                value={f.emails}
                onFocus={onInputFocus}
                onChange={(e) => set({ emails: e.target.value })}
                placeholder="name@example.com"
              />
            </div>
          </div>

          {/* بخش ۳: شغل و موقعیت */}
          <div className="pe-section">
            <div className="pe-section-title">
              <Icon name="toolbox" size={16} />
              <span>{tx('شغل و موقعیت')}</span>
            </div>

            <div className="pe-grid-2">
              <div className="pe-field">
                <label className="pe-label"><span>{tx('شغل / حرفه')}</span></label>
                <input
                  className="pe-input"
                  value={f.occupation}
                  maxLength={60}
                  onFocus={onInputFocus}
                  onChange={(e) => set({ occupation: e.target.value })}
                  placeholder={tx('مثلاً طراح، برنامه‌نویس')}
                />
              </div>
              <div className="pe-field">
                <label className="pe-label"><span>{tx('شهر سکونت')}</span></label>
                <input
                  className="pe-input"
                  value={f.city}
                  maxLength={50}
                  onFocus={onInputFocus}
                  onChange={(e) => set({ city: e.target.value })}
                  placeholder={tx('مثلاً تهران')}
                />
              </div>
            </div>

            <div className="pe-field">
              <label className="pe-label"><span>{tx('محل کار یا سازمان')}</span></label>
              <input
                className="pe-input"
                value={f.workplace}
                maxLength={80}
                onFocus={onInputFocus}
                onChange={(e) => set({ workplace: e.target.value })}
                placeholder={tx('مثلاً نام شرکت یا سازمان')}
              />
            </div>
          </div>

          {/* بخش ۴: تاریخ تولد */}
          <div className="pe-section">
            <div className="pe-section-title">
              <Icon name="cake" size={16} />
              <span>{tx('تاریخ تولد')}</span>
            </div>

            <div className="pe-birthday-toggle">
              <div>
                <b style={{ fontSize: '12.5px' }}>{tx('تنظیم تاریخ تولد')}</b>
                <p className="pe-helper" style={{ margin: 0 }}>{tx('یادآوری تولد و نمایش سن')}</p>
              </div>
              {!bdayOpen ? (
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => { setBday(emptyDraft()); setBdayOpen(true); }}
                >
                  <Icon name="plus" size={13} stroke={2.4} /> {tx('افزودن')}</button>
              ) : (
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => { setBday(null); setBdayOpen(false); }}
                >{tx('برداشتن')}</button>
              )}
            </div>

            {bdayOpen && bday && (
              <div style={{ marginTop: '12px' }}>
                <BirthdayFields d={bday} set={(patch) => setBday((x) => (x ? { ...x, ...patch } : x))} lockName />
              </div>
            )}

            {data?.birthday && bdayOpen && (
              <Button variant="danger" block size="sm" onClick={clearBirthday}>
                {tx('حذف کامل تولد از یادآورها')}
              </Button>
            )}
          </div>

          {/* بخش ۵: حفظ ارتباط */}
          <div className="pe-section">
            <div className="pe-section-title">
              <Icon name="repeat" size={16} />
              <span>{tx('حفظ ارتباط')}</span>
            </div>

            <Select
              label={tx('هر چند وقت یک بار یادت بیندازد')}
              hint={tx('اگر بیشتر از این مدت تماسی با این فرد ثبت نشود، در «امروز» یادت می‌اندازد.')}
              value={f.cadenceDays ?? ''}
              onChange={(e) => set({ cadenceDays: e.target.value ? Number(e.target.value) : undefined })}
              options={[
                { value: '', label: tx('بدون یادآوری') },
                ...CADENCES.map((d) => ({ value: d, label: tx('هر {a1} روز', { a1: fa(d) }) })),
              ]}
            />
          </div>

          {/* دکمه ذخیره انتهای فرم برای راحتی بیشتر کاربر */}
          <div className="pe-bottom-save">
            <Button
              variant="primary"
              block
              size="lg"
              disabled={!valid || busy}
              onClick={save}
              icon="check"
            >
              {busy ? tx('در حال ذخیره…') : isNew ? tx('ثبت و افزودن فرد') : tx('ذخیره تغییرات')}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
