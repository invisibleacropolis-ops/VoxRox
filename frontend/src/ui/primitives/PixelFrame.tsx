import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import './primitives.css';

export type FrameVariant =
  | 'solid'
  | 'sunken'
  | 'raised'
  | 'dashed'
  | 'accent'
  | 'gold';

export interface PixelFrameProps extends HTMLAttributes<HTMLElement> {
  variant?: FrameVariant;
  /** Brass corner studs on the inner face. */
  studded?: boolean;
  /** Slow ambient specular drift across the face. */
  glint?: boolean;
  /** Drop the face padding — for windows and panels that manage their own. */
  flush?: boolean;
  as?: ElementType;
  faceClassName?: string;
  children?: ReactNode;
  // Callers (RenderedTurn, ChatScreen) attach data-testid / data-active.
  // HTMLAttributes does not cover data-*, so allow it explicitly.
  [key: `data-${string}`]: unknown;
}

export function PixelFrame({
  variant = 'solid',
  studded = false,
  glint = false,
  flush = false,
  as: Tag = 'div',
  className = '',
  faceClassName = '',
  children,
  ...rest
}: PixelFrameProps) {
  const outer = [
    'vx-frame',
    `vx-frame--${variant}`,
    studded ? 'vx-frame--studded' : '',
    flush ? 'vx-frame--flush' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const face = [
    'vx-frame__face',
    glint ? 'vx-glint vx-glint--slow' : '',
    faceClassName,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag className={outer} {...rest}>
      <div className={face}>{children}</div>
    </Tag>
  );
}
