import { useEffect, type ReactNode } from 'react';
import { PixelFrame } from './PixelFrame';
import './primitives.css';

export interface PixelWindowProps {
  open: boolean;
  title: ReactNode;
  onClose?: () => void;
  modal?: boolean;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}

export function PixelWindow({
  open,
  title,
  onClose,
  modal = false,
  footer,
  className = '',
  bodyClassName = '',
  children,
}: PixelWindowProps) {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const titleText = typeof title === 'string' ? title : 'window';

  const windowEl = (
    <PixelFrame
      variant="raised"
      role="dialog"
      aria-modal={modal || undefined}
      aria-label={titleText}
      className={`vx-window vx-anim-open ${className}`}
    >
      <div className="vx-window__bar">
        <span className="vx-window__title">{title}</span>
        {onClose && (
          <button
            type="button"
            className="vx-btn vx-btn--sm vx-window__close"
            aria-label={`Close ${titleText}`}
            onClick={onClose}
          >
            X
          </button>
        )}
      </div>
      <div className={`vx-window__body ${bodyClassName}`}>{children}</div>
      {footer && <div className="vx-window__footer">{footer}</div>}
    </PixelFrame>
  );

  if (!modal) return windowEl;
  return (
    <div
      className="vx-window-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      {windowEl}
    </div>
  );
}
