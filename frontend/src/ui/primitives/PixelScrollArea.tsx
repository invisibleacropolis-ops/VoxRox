import type { HTMLAttributes, ReactNode } from 'react';
import './primitives.css';

export interface PixelScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  horizontal?: boolean;
  children?: ReactNode;
}

export function PixelScrollArea({
  horizontal = false,
  className = '',
  children,
  ...rest
}: PixelScrollAreaProps) {
  return (
    <div
      className={`vx-scroll ${horizontal ? 'vx-scroll--x' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
