import { type HTMLAttributes, type ReactNode } from 'react';

export type CardVariant = 'glass' | 'solid' | 'flat';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
  children?: ReactNode;
}

export function Card({
  variant = 'glass',
  interactive = false,
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={`ui-card ui-card-${variant}${interactive ? ' ui-card-interactive' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
