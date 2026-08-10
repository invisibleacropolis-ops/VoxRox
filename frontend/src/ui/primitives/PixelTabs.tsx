import type { ReactNode } from 'react';
import './primitives.css';

export interface TabItem {
  id: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface PixelTabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}

export function PixelTabs({
  items,
  value,
  onChange,
  label,
  className = '',
}: PixelTabsProps) {
  const enabled = items.filter((item) => !item.disabled);

  const step = (direction: 1 | -1) => {
    if (enabled.length === 0) return;
    const current = enabled.findIndex((item) => item.id === value);
    const next = (current + direction + enabled.length) % enabled.length;
    onChange(enabled[next].id);
  };

  return (
    <div role="tablist" aria-label={label} className={`vx-tabs ${className}`}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          className="vx-tab"
          aria-selected={item.id === value}
          disabled={item.disabled}
          tabIndex={item.id === value ? 0 : -1}
          onClick={() => !item.disabled && onChange(item.id)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              step(1);
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault();
              step(-1);
            }
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
