import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BANNER_COLORS, PixelColorPicker } from './PixelColorPicker';

describe('PixelColorPicker', () => {
  it('renders every preset plus the custom swatch', () => {
    render(<PixelColorPicker value="#f2c14e" onChange={() => {}} />);
    // presets are buttons; the custom one is a label wrapping <input type=color>
    expect(screen.getAllByRole('button')).toHaveLength(BANNER_COLORS.length);
    expect(screen.getByLabelText('Custom colour')).toBeInTheDocument();
  });

  it('marks the active preset as pressed', () => {
    render(<PixelColorPicker value="#6fe3a1" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '#6fe3a1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '#f2c14e' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('matches the active preset case-insensitively', () => {
    render(<PixelColorPicker value="#6FE3A1" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '#6fe3a1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('emits the chosen preset', async () => {
    const onChange = vi.fn();
    render(<PixelColorPicker value="#f2c14e" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '#c2384f' }));
    expect(onChange).toHaveBeenCalledWith('#c2384f');
  });

  it('emits a custom colour', () => {
    const onChange = vi.fn();
    render(<PixelColorPicker value="#f2c14e" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Custom colour'), {
      target: { value: '#123456' },
    });
    expect(onChange).toHaveBeenCalledWith('#123456');
  });

  it('labels the group', () => {
    render(<PixelColorPicker value="#f2c14e" onChange={() => {}} label="Banner" />);
    expect(screen.getByRole('group', { name: 'Banner' })).toBeInTheDocument();
  });
});
