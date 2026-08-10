import { useId } from 'react';
import './primitives.css';

export interface PixelSliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

export function PixelSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format = (v) => String(v),
  disabled = false,
  className = '',
}: PixelSliderProps) {
  const id = useId();
  const span = max - min;
  const fraction = span > 0 ? (value - min) / span : 0;
  const percent = Math.max(0, Math.min(1, fraction)) * 100;

  return (
    <div className={`vx-slider ${disabled ? 'vx-slider--disabled' : ''} ${className}`}>
      <label className="vx-slider__label" htmlFor={id}>
        <span>{label}</span>
        <span className="vx-slider__value">{format(value)}</span>
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
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
