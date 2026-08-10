import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { PixelStepSlider } from './PixelStepSlider';

const AGES = ['—', 'child', 'teenage', 'young adult', 'middle-aged', 'elderly'];

describe('PixelStepSlider', () => {
  it('shows the label and the option at the current index', () => {
    render(
      <PixelStepSlider label="Age" options={AGES} index={3} onChange={() => {}} />,
    );
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('young adult')).toBeInTheDocument();
  });

  it('reports the new index as a number', () => {
    const onChange = vi.fn();
    render(<PixelStepSlider label="Age" options={AGES} index={0} onChange={onChange} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('sets max to the last option index', () => {
    render(<PixelStepSlider label="Age" options={AGES} index={0} onChange={() => {}} />);
    expect(screen.getByRole('slider')).toHaveAttribute('max', '5');
  });

  it('marks the active notch', () => {
    render(<PixelStepSlider label="Age" options={AGES} index={2} onChange={() => {}} />);
    const notches = screen.getAllByTestId('notch');
    expect(notches[2]).toHaveAttribute('data-active', 'true');
    expect(notches[0]).toHaveAttribute('data-active', 'false');
  });

  it('clamps an out-of-range index into the array', () => {
    render(<PixelStepSlider label="Age" options={AGES} index={99} onChange={() => {}} />);
    expect(screen.getByText('elderly')).toBeInTheDocument();
  });
});
