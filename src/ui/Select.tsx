import { type SelectHTMLAttributes, useId } from 'react';
import { Icon, type IconName } from '../Icon';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  icon?: IconName;
  options?: SelectOption[];
  containerClassName?: string;
}

export function Select({
  label,
  hint,
  required,
  error,
  icon,
  options,
  children,
  className = '',
  containerClassName = '',
  id: explicitId,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const selectId = explicitId || generatedId;

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
        <select
          id={selectId}
          className={`input-element ui-select-element ${className}`.trim()}
          {...rest}
        >
          {options
            ? options.map(opt => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {icon && (
          <div className="input-icon-slot" aria-hidden="true">
            <Icon name={icon} size={16} stroke={2} />
          </div>
        )}
      </div>

      {error && <span className="input-error-text" role="alert">{error}</span>}
    </div>
  );
}
