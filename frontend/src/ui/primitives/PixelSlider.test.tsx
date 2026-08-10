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

  it('fills the run to the value fraction', () => {
    render(
      <PixelSlider label="Speed" min={0} max={200} step={1} value={50} onChange={() => {}} />,
    );
    expect(screen.getByTestId('slider-fill')).toHaveStyle({ width: '25%' });
  });

  it('clamps the fill for an out-of-range value', () => {
    render(
      <PixelSlider label="Speed" min={0} max={10} step={1} value={99} onChange={() => {}} />,
    );
    expect(screen.getByTestId('slider-fill')).toHaveStyle({ width: '100%' });
  });

  it('does not divide by zero when min equals max', () => {
    render(
      <PixelSlider label="Speed" min={5} max={5} step={1} value={5} onChange={() => {}} />,
    );
    expect(screen.getByTestId('slider-fill')).toHaveStyle({ width: '0%' });
  });

  it('can be disabled', () => {
    render(
      <PixelSlider label="Speed" min={0} max={2} step={0.1} value={1} onChange={() => {}} disabled />,
    );
    expect(screen.getByRole('slider')).toBeDisabled();
  });
});
