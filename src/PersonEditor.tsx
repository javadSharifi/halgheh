import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { type Birthday, type Person, db, del, put, uid } from './db';
import { BirthdayFields, type BirthdayDraft, draftOf, emptyDraft, readDraft, rowOf } from './BirthdayFields';
import { personNameValid, splitPhones } from './phone';
import { ask } from './confirm';
import { Icon } from './Icon';

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
}: {
  data?: PersonEdit | null;
  onClose: () => void;
  onSaved?: (personId: string) => void;
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
    city: p.city ?? '',
    occupation: p.occupation ?? '',
    workplace: p.workplace ?? '',
    phones: (p.phones ?? []).join('، '),
    emails: (p.emails ?? []).join('، '),
  }));
  const [bday, setBday] = useState<BirthdayDraft | null>(() => {
    if (data?.birthday) return draftOf(data.birthday);
    return null;
  });
  const [bdayOpen, setBdayOpen] = useState(!!data?.birthday);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));

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
        city: trim(f.city),
        occupation: trim(f.occupation),
        workplace: trim(f.workplace),
        phones,
        emails,
        createdAt: p.createdAt || now,
        updatedAt: now,
      };
      for (const k of ['firstName', 'lastName', 'nickname', 'city', 'occupation', 'workplace'] as const) {
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
      setError('ذخیره نشد؛ دوباره تلاش کن.');
      setBusy(false);
    }
  };

  const clearBirthday = async () => {
    if (!data?.birthday) return;
    if (await ask({ title: 'تولد حذف شود؟', message: 'تولد این فرد از یادآورها و صفحهٔ امروز هم پاک می‌شود.', confirm: 'حذف' })) {
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
      <div className="scrim dim" onClick={onClose} />
      <section className="sheet person-editor-sheet" role="dialog" aria-modal="true" aria-labelledby="person-editor-title">
        <header className="pe-header">
          <button className="pe-header-action close" type="button" onClick={onClose}>انصراف</button>
          <div className="pe-header-title">
            <Icon name={isNew ? 'users' : 'edit'} size={17} />
            <span id="person-editor-title">{isNew ? 'افزودن فرد جدید' : 'ویرایش مشخصات'}</span>
          </div>
          <button
            className="primary pe-header-action save"
            type="button"
            disabled={!valid || busy}
            onClick={save}
          >
            <Icon name="check" size={15} stroke={2.5} />
            <span>{busy ? '…' : isNew ? 'ثبت' : 'ذخیره'}</span>
          </button>
        </header>

        <div className="pe-content">
          {error && <p className="pe-error-text" role="alert">{error}</p>}

          {/* بخش ۱: مشخصات فردی */}
          <div className="pe-section">
            <div className="pe-section-title">
              <Icon name="users" size={16} />
              <span>مشخصات فردی و نام</span>
            </div>

            <div className={`pe-field${!personNameValid(f.displayName) && f.displayName.trim() ? ' has-error' : ''}`}>
              <label className="pe-label">
                <span>نام نمایشی</span>
                <span className="req">* اجباری</span>
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
                placeholder="مثلاً علی رضایی"
              />
              {twin && (
                <p className="pe-helper" style={{ color: 'var(--amber-ink, #d97706)', marginTop: '4px' }}>
                  «{twin.displayName}» از قبل در فهرست هست. اگر این فرد دیگری است، می‌توانید ثبتش کنید.
                </p>
              )}
            </div>

            <div className="pe-grid-2">
              <div className="pe-field">
                <label className="pe-label"><span>نام</span></label>
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
                  placeholder="نام کوچک"
                />
              </div>
              <div className="pe-field">
                <label className="pe-label"><span>نام خانوادگی</span></label>
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
                  placeholder="نام خانوادگی"
                />
              </div>
            </div>

            <div className="pe-field">
              <label className="pe-label"><span>نام مستعار یا لقب</span></label>
              <input
                className="pe-input"
                value={f.nickname}
                maxLength={60}
                onFocus={onInputFocus}
                onChange={(e) => set({ nickname: e.target.value })}
                placeholder="مثلاً مهندس، عمو علی"
              />
            </div>
          </div>

          {/* بخش ۲: ارتباط و تماس */}
          <div className="pe-section">
            <div className="pe-section-title">
              <Icon name="phone" size={16} />
              <span>اطلاعات تماس</span>
            </div>

            <div className={`pe-field${badPhone ? ' has-error' : ''}`}>
              <label className="pe-label"><span>شماره تلفن‌ها</span></label>
              <input
                className="pe-input"
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={f.phones}
                onFocus={onInputFocus}
                onChange={(e) => set({ phones: e.target.value })}
                placeholder="0912...، 021..."
              />
              {badPhone ? (
                <p className="pe-error-text">شماره معتبر نیست. با رقم بنویسید و چند شماره را با «،» جدا کنید.</p>
              ) : phones.length > 1 ? (
                <span className="pe-helper">{phones.length} شماره با ویرگول (،) جدا شده‌اند.</span>
              ) : null}
            </div>

            <div className="pe-field">
              <label className="pe-label"><span>آدرس ایمیل</span></label>
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
              <span>شغل و موقعیت</span>
            </div>

            <div className="pe-grid-2">
              <div className="pe-field">
                <label className="pe-label"><span>شغل / حرفه</span></label>
                <input
                  className="pe-input"
                  value={f.occupation}
                  maxLength={60}
                  onFocus={onInputFocus}
                  onChange={(e) => set({ occupation: e.target.value })}
                  placeholder="مثلاً طراح، برنامه‌نویس"
                />
              </div>
              <div className="pe-field">
                <label className="pe-label"><span>شهر سکونت</span></label>
                <input
                  className="pe-input"
                  value={f.city}
                  maxLength={50}
                  onFocus={onInputFocus}
                  onChange={(e) => set({ city: e.target.value })}
                  placeholder="مثلاً تهران"
                />
              </div>
            </div>

            <div className="pe-field">
              <label className="pe-label"><span>محل کار یا سازمان</span></label>
              <input
                className="pe-input"
                value={f.workplace}
                maxLength={80}
                onFocus={onInputFocus}
                onChange={(e) => set({ workplace: e.target.value })}
                placeholder="مثلاً نام شرکت یا سازمان"
              />
            </div>
          </div>

          {/* بخش ۴: تاریخ تولد */}
          <div className="pe-section">
            <div className="pe-section-title">
              <Icon name="cake" size={16} />
              <span>تاریخ تولد</span>
            </div>

            <div className="pe-birthday-toggle">
              <div>
                <b style={{ fontSize: '12.5px' }}>تنظیم تاریخ تولد</b>
                <p className="pe-helper" style={{ margin: 0 }}>یادآوری تولد و نمایش سن</p>
              </div>
              {!bdayOpen ? (
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => { setBday(emptyDraft()); setBdayOpen(true); }}
                >
                  <Icon name="plus" size={13} stroke={2.4} /> افزودن
                </button>
              ) : (
                <button
                  type="button"
                  className="mini-btn"
                  onClick={() => { setBday(null); setBdayOpen(false); }}
                >
                  برداشتن
                </button>
              )}
            </div>

            {bdayOpen && bday && (
              <div style={{ marginTop: '12px' }}>
                <BirthdayFields d={bday} set={(patch) => setBday((x) => (x ? { ...x, ...patch } : x))} lockName />
              </div>
            )}

            {data?.birthday && bdayOpen && (
              <button type="button" className="pe-del-btn" onClick={clearBirthday}>
                حذف کامل تولد از یادآورها
              </button>
            )}
          </div>

          {/* دکمه ذخیره انتهای فرم برای راحتی بیشتر کاربر */}
          <div className="pe-bottom-save">
            <button
              type="button"
              className="primary pe-save-btn"
              disabled={!valid || busy}
              onClick={save}
            >
              <Icon name="check" size={18} stroke={2.4} />
              <span>{busy ? 'در حال ذخیره…' : isNew ? 'ثبت و افزودن فرد' : 'ذخیره تغییرات'}</span>
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
