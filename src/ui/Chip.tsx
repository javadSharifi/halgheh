import { type HTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

export type ChipVariant = 'default' | 'primary' | 'success' | 'danger' | 'warning';
export type ChipSize = 'sm' | 'md';

export interface ChipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'onClick'> {
  active?: boolean;
  variant?: ChipVariant;
  size?: ChipSize;
  icon?: IconName;
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
  children?: ReactNode;
}

export function Chip({
  active = false,
  variant = 'default',
  size = 'md',
  icon,
  onClick,
  onRemove,
  removeLabel = 'حذف',
  className = '',
  children,
  ...rest
}: ChipProps) {
  const isClickable = !!onClick;

  return (
    <span
      className={`ui-chip ui-chip-${variant} ui-chip-${size}${active ? ' is-active' : ''}${isClickable ? ' is-clickable' : ''} ${className}`.trim()}
      {...rest}
    >
      {isClickable ? (
        <button
          type="button"
          className="ui-chip-action"
          onClick={onClick}
        >
          {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
          {children && <span>{children}</span>}
        </button>
      ) : (
        <span className="ui-chip-content">
          {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
          {children && <span>{children}</span>}
        </span>
      )}

      {onRemove && (
        <button
          type="button"
          className="ui-chip-remove"
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={removeLabel}
        >
          <Icon name="close" size={12} />
        </button>
      )}
    </span>
  );
}
