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
  return (
    <div className={`vx-slider ${className}`}>
      <label className="vx-slider__label" htmlFor={id}>
        <span>{label}</span>
        <span className="vx-slider__value">{format(value)}</span>
      </label>
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
        style={{ gridColumn: '1 / -1' }}
      />
    </div>
  );
}
