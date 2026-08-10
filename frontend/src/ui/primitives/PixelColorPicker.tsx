import './primitives.css';

/** Sixteen banner colours — saturated enough to read at card size on dark chrome. */
export const BANNER_COLORS = [
  '#f2c14e', '#e08b3c', '#d9614c', '#c2384f',
  '#b3519e', '#8a5cd6', '#6a6fe0', '#4f8fe0',
  '#3fb8c9', '#3fb87a', '#6fe3a1', '#a8d34a',
  '#d6d24a', '#b98f5a', '#9aa3b8', '#e8e6f5',
] as const;

export interface PixelColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  className?: string;
}

export function PixelColorPicker({
  value,
  onChange,
  label = 'Banner colour',
  className = '',
}: PixelColorPickerProps) {
  const normalized = value.toLowerCase();

  return (
    <div className={`vx-swatches ${className}`} role="group" aria-label={label}>
      {BANNER_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className="vx-swatch"
          style={{ background: color }}
          aria-label={color}
          aria-pressed={normalized === color.toLowerCase()}
          onClick={() => onChange(color)}
        />
      ))}
      <label
        className="vx-swatch"
        style={{
          background: `linear-gradient(135deg, ${value} 0 45%, #07060c 46% 54%, ${value} 55% 100%)`,
        }}
        title="Custom colour"
      >
        <input
          type="color"
          className="vx-swatch__custom"
          aria-label="Custom colour"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}
