import { CAL_NAMES, fa, monthName } from '../cal';
import type { Birthday, Person, PersonNote, PersonTag, Tag } from '../db';
import { Icon } from '../Icon';
import { normPhone } from '../phone';
import { NoteBox } from '../NoteBox';
import { TagEditor } from '../TagEditor';
import { ageOf, smsHref } from './shared';
import { join, tx } from '../i18n';

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
          <h2 className="sec-title" style={{ marginTop: 0 }}>{tx('شماره‌های تماس')}</h2>
          <div className="glass phone-list">
            {phones.map((ph) => (
              <div className="phone-row" key={ph}>
                <span className="tile blue" aria-hidden="true"><Icon name="phone" size={16} stroke={1.9} /></span>
                <span dir="ltr" className="phone-num">{ph}</span>
                <a className="icon-btn small" href={`tel:${normPhone(ph)}`} aria-label={tx('تماس با {a1}', { a1: p.displayName })}><Icon name="phone" size={17} stroke={1.9} /></a>
                <a className="icon-btn small" href={smsHref(normPhone(ph), p.displayName)} aria-label={tx('پیام به {a1}', { a1: p.displayName })}><Icon name="note" size={17} stroke={1.9} /></a>
              </div>
            ))}
          </div>
        </section>
      )}
      {phones.length === 0 && p.emails.length === 0 && (
        <div className="glass empty-state small">
          <b>{tx('شمارهٔ تماسی ثبت نشده')}</b>
          <p className="hint">{tx('برای افزودن شماره یا ایمیل، دکمهٔ «ویرایش مشخصات مخاطب» را بزنید.')}</p>
        </div>
      )}

      {p.emails.length > 0 && (
        <section>
          <h2 className="sec-title">{tx('ایمیل‌ها')}</h2>
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
        <h2 className="sec-title">{tx('تولد')}</h2>
        <div className="glass set-list">
          {bd ? (
            <button className="set-row as-btn" onClick={onEdit}>
              <span className="tile peach" aria-hidden="true"><Icon name="cake" size={17} stroke={1.9} /></span>
              <span className="set-name">
                {fa(bd.day)} {monthName(bd.cal, bd.month)}{bd.year ? ` ${fa(bd.year)}` : ''}
                <small className="set-sub">{join([tx(CAL_NAMES[bd.cal]), age !== null && tx('{a1} ساله', { a1: fa(age) })])}</small>
              </span>
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          ) : (
            <button className="set-row as-btn" onClick={onEdit}>
              <span className="tile peach" aria-hidden="true"><Icon name="cake" size={17} stroke={1.9} /></span>
              <span className="set-name">{tx('تولد ثبت نشده')}<small className="set-sub">{tx('برای افزودن بزن')}</small></span>
              <Icon name="chevronLeft" size={16} stroke={2} />
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="sec-title">{tx('برچسب‌ها')}</h2>
        <section className="glass tag-card">
          <TagEditor personId={p.id} links={tagLinks} tags={tags} />
        </section>
      </section>

      <section>
        <h2 className="sec-title">{tx('یادداشت')}</h2>
        <NoteBox note={note} onSave={onSaveNote} />
      </section>

      <div className="person-actions foot">
        <button onClick={onArchive}><Icon name="archive" size={16} stroke={2} />{tx('بایگانی')}</button>
        <button className="danger-btn" onClick={onRemove}><Icon name="trash" size={16} stroke={2} />{tx('حذف')}</button>
      </div>
    </div>
  );
}
