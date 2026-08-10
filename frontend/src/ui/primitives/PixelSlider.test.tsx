import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { PixelSlider } from './PixelSlider';

describe('PixelSlider', () => {
  it('renders the label and formatted value', () => {
    render(
      <PixelSlider
        label="Speed"
        min={0.5}
        max={2}
        step={0.05}
        value={1.25}
        onChange={() => {}}
        format={(v) => `${v.toFixed(2)}x`}
      />,
    );
    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('1.25x')).toBeInTheDocument();
  });

  it('reports numeric changes', () => {
    const onChange = vi.fn();
    render(
      <PixelSlider label="Speed" min={0.5} max={2} step={0.05} value={1} onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1.5' } });
    expect(onChange).toHaveBeenCalledWith(1.5);
  });

  it('exposes range attributes for assistive tech', () => {
    render(
      <PixelSlider label="Delay" min={0} max={5000} step={50} value={300} onChange={() => {}} />,
    );
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '5000');
    expect(slider).toHaveAttribute('step', '50');
    expect(slider).toHaveValue('300');
  });

  it('can be disabled', () => {
    render(
      <PixelSlider label="Speed" min={0} max={2} step={0.1} value={1} onChange={() => {}} disabled />,
    );
    expect(screen.getByRole('slider')).toBeDisabled();
  });
});
