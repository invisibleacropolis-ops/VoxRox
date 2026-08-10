import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import './primitives.css';

/** Matches --press-dur, with headroom so the release never cuts the last frame. */
const PRESS_MS = 200;

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
  onPointerDown,
  ...rest
}: PixelButtonProps) {
  // Latched so a fast click still plays all 8 press frames; :active would
  // end the moment the pointer lifts.
  const [pressing, setPressing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const release = useCallback(() => {
    clearTimer();
    setPressing(false);
  }, [clearTimer]);

  // A timer, not animationend alone: under prefers-reduced-motion the
  // animation is suppressed and animationend never fires, which would leave
  // the button latched in its pressed state forever.
  const press = useCallback(() => {
    clearTimer();
    setPressing(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setPressing(false);
    }, PRESS_MS);
  }, [clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

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
      data-pressing={pressing ? 'true' : undefined}
      onPointerDown={(event) => {
        if (!disabled && !busy) press();
        onPointerDown?.(event);
      }}
      onAnimationEnd={release}
      {...rest}
    >
      <span className="vx-btn__face vx-glint">{children}</span>
    </button>
  );
}
