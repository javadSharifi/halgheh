import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon-sm' | 'icon-md' | 'icon-lg';

type BaseButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

interface StandardButtonProps extends BaseButtonProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: ButtonVariant;
  icon?: IconName;
  iconPosition?: 'start' | 'end';
  block?: boolean;
  children?: ReactNode;
  'aria-label'?: string;
}

interface IconButtonProps extends BaseButtonProps {
  size: 'icon-sm' | 'icon-md' | 'icon-lg';
  variant?: ButtonVariant;
  icon: IconName;
  iconPosition?: never;
  block?: boolean;
  children?: never;
  'aria-label': string; // Mandatory for accessibility on icon-only buttons
}

export type ButtonProps = StandardButtonProps | IconButtonProps;

export function Button({
  type = 'button',
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'start',
  block,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  const isIconOnly = size.startsWith('icon-');
  const iconSize =
    size === 'sm' || size === 'icon-sm'
      ? 14
      : size === 'lg' || size === 'icon-lg'
        ? 18
        : 16;

  const iconEl = icon ? <Icon name={icon} size={iconSize} /> : null;
  const hasChildren = children !== undefined && children !== null && children !== false;

  return (
    <button
      type={type}
      className={`ui-btn ui-btn-${variant} ui-btn-${size}${block ? ' ui-btn-block' : ''}${isIconOnly ? ' ui-btn-icon' : ''} ${className}`.trim()}
      disabled={disabled}
      {...rest}
    >
      {icon && iconPosition === 'start' && iconEl}
      {hasChildren && <span>{children}</span>}
      {icon && iconPosition === 'end' && iconEl}
    </button>
  );
}
