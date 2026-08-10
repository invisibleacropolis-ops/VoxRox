import type { ReactNode } from 'react';
import { PixelFrame, type FrameVariant } from './PixelFrame';
import './primitives.css';

export interface PixelPanelProps {
  title?: ReactNode;
  actions?: ReactNode;
  variant?: FrameVariant;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

export function PixelPanel({
  title,
  actions,
  variant = 'solid',
  className = '',
  bodyClassName = '',
  children,
}: PixelPanelProps) {
  return (
    <PixelFrame variant={variant} className={`vx-panel ${className}`}>
      {title !== undefined && (
        <div className="vx-panel__title">
          <span>{title}</span>
          {actions && <span>{actions}</span>}
        </div>
      )}
      <div className={`vx-panel__body ${bodyClassName}`}>{children}</div>
    </PixelFrame>
  );
}
