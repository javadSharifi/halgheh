import { type ChangeEvent, type SelectHTMLAttributes, useId, useState } from 'react';
import { Icon, type IconName } from '../Icon';
import { tx } from '../i18n';
import { InputField } from './InputField';
import { Sheet } from './Sheet';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'children'> {
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  icon?: IconName;
  options: SelectOption[];
  containerClassName?: string;
}

const SEARCH_FROM = 8; // a longer list (people, items) gets a search box

/**
 * A field that opens a bottom sheet of options instead of the browser's native popup, which looks different on every
 * device and cannot be styled. `onChange` still receives an event with `target.value`, so callers read it as before.
 */
export function Select({
  label,
  hint,
  required,
  error,
  icon,
  options,
  className = '',
  containerClassName = '',
  id: explicitId,
  value,
  onChange,
  disabled,
  name,
  'aria-label': ariaLabel,
}: SelectProps) {
  const generatedId = useId();
  const selectId = explicitId || generatedId;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = options.find((o) => String(o.value) === String(value ?? ''));
  const shown = q.trim() ? options.filter((o) => o.label.toLocaleLowerCase('fa').includes(q.trim().toLocaleLowerCase('fa'))) : options;

  const close = () => {
    setOpen(false);
    setQ('');
  };
  const pick = (o: SelectOption) => {
    onChange?.({ target: { value: String(o.value), name }, currentTarget: { value: String(o.value), name } } as unknown as ChangeEvent<HTMLSelectElement>);
    close();
  };

  return (
    <div className={`input-field-group ${containerClassName}`.trim()}>
      {label && (
        <div className="input-label-row">
          <label htmlFor={selectId} className="input-label-text">
            <span>{label}</span>
            {required && <span className="input-required-star"> *</span>}
          </label>
          {hint && <span className="input-hint-text">{hint}</span>}
        </div>
      )}

      <div className={`input-box-wrapper ui-select-wrapper${error ? ' has-error' : ''}${icon ? ' has-icon' : ''}`}>
        <button
          id={selectId}
          type="button"
          className={`input-element ui-select-trigger ${className}`.trim()}
          aria-haspopup="dialog"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <span className="ui-select-value">{current?.label ?? ''}</span>
          <Icon name="chevronDown" size={16} stroke={2} />
        </button>
        {icon && (
          <div className="input-icon-slot" aria-hidden="true">
            <Icon name={icon} size={16} stroke={2} />
          </div>
        )}
      </div>

      {error && <span className="input-error-text" role="alert">{error}</span>}

      <Sheet open={open} onClose={close} title={label ?? ariaLabel}>
        {options.length > SEARCH_FROM && (
          <InputField type="search" icon="search" aria-label={tx('جستجو')} placeholder={tx('جستجو')} value={q} onChange={(e) => setQ(e.target.value)} />
        )}
        <div className="pick-list" role="radiogroup" aria-label={label}>
          {shown.map((o) => {
            const on = String(o.value) === String(value ?? '');
            return (
              <button key={o.value} type="button" role="radio" aria-checked={on} disabled={o.disabled} className={`pick-opt${on ? ' on' : ''}`} onClick={() => pick(o)}>
                <span>{o.label}</span>
                {on && <Icon name="check" size={18} stroke={2.4} />}
              </button>
            );
          })}
          {shown.length === 0 && <p className="hint empty">{tx('موردی پیدا نشد.')}</p>}
        </div>
      </Sheet>
    </div>
  );
}
