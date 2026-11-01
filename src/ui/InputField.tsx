import { type InputHTMLAttributes, type TextareaHTMLAttributes, useId } from 'react';
import { Icon, type IconName } from '../Icon';

export interface InputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  required?: boolean;
  error?: string;
  icon?: IconName;
  multiline?: boolean;
  rows?: number;
  containerClassName?: string;
}

export function InputField({
  label,
  hint,
  required,
  error,
  icon,
  multiline,
  rows = 3,
  className = '',
  containerClassName = '',
  id: explicitId,
  ...rest
}: InputFieldProps) {
  const generatedId = useId();
  const inputId = explicitId || generatedId;

  return (
    <div className={`input-field-group ${containerClassName}`.trim()}>
      {label && (
        <div className="input-label-row">
          <label htmlFor={inputId} className="input-label-text">
            <span>{label}</span>
            {required && <span className="input-required-star"> *</span>}
          </label>
          {hint && <span className="input-hint-text">{hint}</span>}
        </div>
      )}

      <div className={`input-box-wrapper${error ? ' has-error' : ''}${icon ? ' has-icon' : ''}`}>
        {multiline ? (
          <textarea
            id={inputId}
            rows={rows}
            className={`input-element textarea-element ${className}`.trim()}
            {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={inputId}
            className={`input-element ${className}`.trim()}
            {...rest}
          />
        )}
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
