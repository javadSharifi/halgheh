import { CAL_NAMES, MONTHS, fa } from '../cal';
import type { Birthday, Person, PersonNote, PersonTag, Tag } from '../db';
import { Icon } from '../Icon';
import { normPhone } from '../phone';
import { NoteBox } from '../NoteBox';
import { TagEditor } from '../TagEditor';
import { ageOf, smsHref } from './shared';

/** Tab 1: phones, emails, birthday, tags, the note, archive/delete. */
export function OverviewTab({ person: p, birthday: bd, note, tags, tagLinks, onEdit, onSaveNote, onArchive, onRemove }: {
  person: Person;
  birthday: Birthday | undefined;
  note: PersonNote | undefined;
  tags: Tag[];
  tagLinks: PersonTag[];
  onEdit: () => void;
  onSaveNote: (text: string) => Promise<void>;
  onArchive: () => void;
  onRemove: () => void;
}) {
  const phones = p.phones.filter(Boolean);
  const age = bd ? ageOf(bd.year, bd.cal, bd.month, bd.day) : null;

  return (
    <div className="tab-pane">
      {phones.length > 0 && (
        <section>
          <h2 className="sec-title" style={{ marginTop: 0 }}>شماره‌های تماس</h2>
          <div className="glass phone-list">
            {phones.map((ph) => (
              <div className="phone-row" key={ph}>
                <span className="tile blue" aria-hidden="true"><Icon name="phone" size={16} stroke={1.9} /></span>
                <span dir="ltr" className="phone-num">{ph}</span>
                <a className="icon-btn small" href={`tel:${normPhone(ph)}`} aria-label={`تماس با ${p.displayName}`}><Icon name="phone" size={17} stroke={1.9} /></a>
                <a className="icon-btn small" href={smsHref(normPhone(ph), p.displayName)} aria-label={`پیام به ${p.displayName}`}><Icon name="note" size={17} stroke={1.9} /></a>
              </div>
            ))}
          </div>
        </section>
      )}
      {phones.length === 0 && p.emails.length === 0 && (
        <div className="glass empty-state small">
          <b>شمارهٔ تماسی ثبت نشده</b>
          <p className="hint">برای افزودن شماره یا ایمیل، دکمهٔ «ویرایش مشخصات مخاطب» را بزنید.</p>
        </div>
      )}

      {p.emails.length > 0 && (
        <section>
          <h2 className="sec-title">ایمیل‌ها</h2>
          <div className="glass set-list">
            {p.emails.map((e) => (
              <div className="role-row" key={e}>
                <span className="tile green" aria-hidden="true"><Icon name="file" size={16} stroke={1.9} /></span>
                <a dir="ltr" className="role-text" href={`mailto:${e}`}>{e}</a>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="sec-title">تولد</h2>
        <div className="glass set-list">
          {bd ? (
            <button className="set-row as-btn" onClick={onEdit}>
              <span className="tile peach" aria-hidden="true"><Icon name="cake" size={17} stroke={1.9} /></span>
              <span className="set-name">
                {fa(bd.day)} {MONTHS[bd.cal][bd.month - 1]}{bd.year ? ` ${fa(bd.year)}` : ''}
                <small className="set-sub">{CAL_NAMES[bd.cal]}{age !== null ? ` · ${fa(age)} ساله` : ''}</small>
              </span>
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          ) : (
            <button className="set-row as-btn" onClick={onEdit}>
              <span className="tile peach" aria-hidden="true"><Icon name="cake" size={17} stroke={1.9} /></span>
              <span className="set-name">تولد ثبت نشده<small className="set-sub">برای افزودن بزن</small></span>
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="sec-title">برچسب‌ها</h2>
        <section className="glass tag-card">
          <TagEditor personId={p.id} links={tagLinks} tags={tags} />
        </section>
      </section>

      <section>
        <h2 className="sec-title">یادداشت</h2>
        <NoteBox note={note} onSave={onSaveNote} />
      </section>

      <div className="person-actions foot">
        <button onClick={onArchive}><Icon name="archive" size={16} stroke={2} />بایگانی</button>
        <button className="danger-btn" onClick={onRemove}><Icon name="trash" size={16} stroke={2} />حذف</button>
      </div>
    </div>
  );
}
