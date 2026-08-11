import { useEffect, type ReactNode } from 'react';
import { PixelFrame } from './PixelFrame';
import './primitives.css';

export interface PixelWindowProps {
  open: boolean;
  title: ReactNode;
  /** Accessible name. Required when `title` is not a plain string. */
  ariaLabel?: string;
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
  ariaLabel,
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

  const titleText = ariaLabel ?? (typeof title === 'string' ? title : 'window');

  const windowEl = (
    <PixelFrame
      variant="gold"
      studded
      flush
      role="dialog"
      aria-modal={modal || undefined}
      aria-label={titleText}
      className={`vx-window vx-anim-open ${className}`}
    >
      <div className="vx-window__bar vx-glint vx-glint--ambient">
        <span className="vx-window__title">{title}</span>
        {onClose && (
          <button
            type="button"
            className="vx-btn vx-btn--sm vx-btn--danger"
            aria-label={`Close ${titleText}`}
            onClick={onClose}
          >
            <span className="vx-btn__face vx-glint">X</span>
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
