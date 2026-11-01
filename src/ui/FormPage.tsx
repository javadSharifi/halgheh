import { type FocusEvent, type ReactNode, useId } from 'react';
import { Icon, type IconName } from '../Icon';
import { tx } from '../i18n';
import { Button } from './Button';

export interface FormPageProps {
  title: string;
  icon?: IconName;
  onClose: () => void;
  /** Omit for a read-only/picker page: the header then shows no save button. */
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  busy?: boolean;
  error?: string;
  /** Shown as a danger button at the bottom; only pass it when editing an existing row. */
  onDelete?: () => void;
  deleteLabel?: string;
  children: ReactNode;
}

/**
 * The one shell for every add/edit screen: back + title + save in the header, sections in the body,
 * delete at the bottom. It sits above the tab bar (z 25) but below sheets (z 30+), so pickers opened from a form still show.
 */
export function FormPage({ title, icon, onClose, onSave, saveLabel, saveDisabled, busy, error, onDelete, deleteLabel, children }: FormPageProps) {
  const titleId = useId();
  // keep the field being typed in clear of the keyboard
  const reveal = (e: FocusEvent<HTMLElement>) => {
    const el = e.target;
    if (el.matches('input, textarea, select')) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  };
  return (
    <div className="form-page" role="dialog" aria-modal="true" aria-labelledby={titleId} onFocus={reveal}>
      <header className="fp-header">
        <button className="fp-back" type="button" aria-label={tx('بازگشت')} onClick={onClose}>
          <Icon name="chevronRight" size={18} stroke={2.2} />
        </button>
        <div className="fp-title">
          {icon && <Icon name={icon} size={17} />}
          <span id={titleId}>{title}</span>
        </div>
        {onSave ? (
          <Button variant="primary" size="sm" icon="check" disabled={saveDisabled || busy} onClick={onSave}>
            {busy ? '…' : (saveLabel ?? tx('ذخیره'))}
          </Button>
        ) : (
          <span className="fp-spacer" />
        )}
      </header>
      <div className="fp-body">
        {error && <p className="fp-error" role="alert">{error}</p>}
        {children}
        {onDelete && (
          <Button variant="danger" block icon="trash" onClick={onDelete}>
            {deleteLabel ?? tx('حذف')}
          </Button>
        )}
      </div>
    </div>
  );
}

/** A titled card of fields inside a FormPage. */
export function FormSection({ title, icon, children }: { title?: string; icon?: IconName; children: ReactNode }) {
  return (
    <section className="fp-section">
      {title && (
        <div className="fp-section-title">
          {icon && <Icon name={icon} size={16} />}
          <span>{title}</span>
        </div>
      )}
      {children}
    </section>
  );
}

/** Label + any control (chips, radios, pickers) so non-input fields line up with InputField. */
export function FormField({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="input-field-group">
      <div className="input-label-row">
        <span className="input-label-text">
          <span>{label}</span>
          {required && <span className="input-required-star"> *</span>}
        </span>
        {hint && <span className="input-hint-text">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
