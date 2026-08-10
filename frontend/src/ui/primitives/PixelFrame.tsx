import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import './primitives.css';

export type FrameVariant = 'solid' | 'sunken' | 'raised' | 'dashed' | 'accent';

export interface PixelFrameProps extends HTMLAttributes<HTMLElement> {
  variant?: FrameVariant;
  notched?: boolean;
  as?: ElementType;
  children?: ReactNode;
  // Callers (RenderedTurn, ChatScreen) attach data-testid / data-active.
  // HTMLAttributes does not cover data-*, so allow it explicitly.
  [key: `data-${string}`]: unknown;
}

export function PixelFrame({
  variant = 'solid',
  notched = false,
  as: Tag = 'div',
  className = '',
  children,
  ...rest
}: PixelFrameProps) {
  const classes = [
    'vx-frame',
    `vx-frame--${variant}`,
    notched ? 'vx-frame--notched' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
