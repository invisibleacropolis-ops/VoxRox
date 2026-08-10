import { useId } from 'react';
import './primitives.css';

export interface PixelStepSliderProps {
  label: string;
  options: string[];
  index: number;
  onChange: (index: number) => void;
  showNotches?: boolean;
  disabled?: boolean;
  className?: string;
  emptyLabel?: string;
}

export function PixelStepSlider({
  label,
  options,
  index,
  onChange,
  showNotches = true,
  disabled = false,
  className = '',
  emptyLabel = '—',
}: PixelStepSliderProps) {
  const id = useId();
  const last = Math.max(options.length - 1, 0);
  const safeIndex = Math.min(Math.max(index, 0), last);
  const current = options[safeIndex] || emptyLabel;

  const percent = last > 0 ? (safeIndex / last) * 100 : 0;

  return (
    <div className={`vx-slider ${disabled ? 'vx-slider--disabled' : ''} ${className}`}>
      <label className="vx-slider__label" htmlFor={id}>
        <span>{label}</span>
        <span className="vx-slider__value">{current}</span>
      </label>
      <div className="vx-slider__rail">
        <div className="vx-slider__channel">
          <div
            className="vx-slider__fill"
            data-testid="slider-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
        <input
          id={id}
          className="vx-slider__input"
          type="range"
          min={0}
          max={last}
          step={1}
          value={safeIndex}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      {showNotches && (
        <div className="vx-slider__notches">
          {options.map((option, position) => (
            <span
              key={`${option}-${position}`}
              className="vx-slider__notch"
              data-testid="notch"
              data-active={position === safeIndex ? 'true' : 'false'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
