import type { Person } from '../db';
import { Icon } from '../Icon';
import { normPhone } from '../phone';
import { STR } from '../strings/rulebook';
import { fullName, paletteOf, smsHref } from './shared';
import { tx } from '../i18n';

/** The avatar card plus the call/sms/email/brief row, both derived from the person alone. */
export function PersonHero({ person: p, onEdit, openBrief }: { person: Person; onEdit: () => void; openBrief: () => void }) {
  const phones = p.phones.filter(Boolean);
  const meta = [p.occupation, p.workplace, p.city].filter(Boolean) as string[];

  return (
    <>
      <section className="glass person-hero">
        <div className="ph-top">
          <span className={`avatar xl p${paletteOf(p.displayName)}`} aria-hidden="true">{p.displayName.trim().slice(0, 1)}</span>
          <div className="ph-main">
            <b><bdi>{p.displayName}</bdi></b>
            <div className="ph-badges">
              {fullName(p) && <span className="ph-badge">{fullName(p)}</span>}
              {p.nickname && <span className="ph-badge ph-nick">{p.nickname}</span>}
            </div>
            {meta.length > 0 && <span className="ph-meta-text">{meta.join(' · ')}</span>}
          </div>
        </div>

        <button className="person-hero-edit-btn" onClick={onEdit}>
          <Icon name="edit" size={17} stroke={2.2} />
          <span>{tx('ویرایش مشخصات مخاطب')}</span>
        </button>
      </section>

      {(phones.length > 0 || p.emails.length > 0) && (
        <div className="quick-actions-bar">
          {phones[0] && (
            <a className="qa-btn" href={`tel:${normPhone(phones[0])}`} aria-label={tx('تماس با {a1}', { a1: p.displayName })}>
              <span className="qa-icon call"><Icon name="phone" size={17} stroke={2} /></span>
              <span>{tx('تماس')}</span>
            </a>
          )}
          {phones[0] && (
            <a className="qa-btn" href={smsHref(normPhone(phones[0]), p.displayName)} aria-label={tx('پیام به {a1}', { a1: p.displayName })}>
              <span className="qa-icon sms"><Icon name="note" size={17} stroke={2} /></span>
              <span>{tx('پیامک')}</span>
            </a>
          )}
          {p.emails[0] && (
            <a className="qa-btn" href={`mailto:${p.emails[0]}`} aria-label={tx('ارسال ایمیل به {a1}', { a1: p.displayName })}>
              <span className="qa-icon mail"><Icon name="file" size={17} stroke={2} /></span>
              <span>{tx('ایمیل')}</span>
            </a>
          )}
          <button className="qa-btn" onClick={openBrief} aria-label={tx(STR.brief.entry)}>
            <span className="qa-icon brief"><Icon name="listChecks" size={17} stroke={2} /></span>
            <span>{tx('خلاصه قرار')}</span>
          </button>
        </div>
      )}
    </>
  );
}
