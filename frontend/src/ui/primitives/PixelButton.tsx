import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './primitives.css';

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface PixelButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  busy?: boolean;
  selected?: boolean;
  children?: ReactNode;
}

export function PixelButton({
  variant = 'default',
  size = 'md',
  busy = false,
  selected = false,
  disabled = false,
  className = '',
  type = 'button',
  children,
  ...rest
}: PixelButtonProps) {
  const classes = [
    'vx-btn',
    variant !== 'default' ? `vx-btn--${variant}` : '',
    size !== 'md' ? `vx-btn--${size}` : '',
    busy ? 'vx-anim-busy' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || busy}
      aria-pressed={selected ? true : undefined}
      data-selected={selected ? 'true' : undefined}
      {...rest}
    >
      {children}
    </button>
  );
}
