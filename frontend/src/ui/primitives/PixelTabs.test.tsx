import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PixelTabs } from './PixelTabs';

const ITEMS = [
  { id: 'a', label: 'Profiles' },
  { id: 'b', label: 'Chat' },
  { id: 'c', label: 'Script', disabled: true },
];

describe('PixelTabs', () => {
  it('marks the active tab as selected', () => {
    render(<PixelTabs items={ITEMS} value="b" onChange={() => {}} label="Main menu" />);
    expect(screen.getByRole('tab', { name: 'Chat' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Profiles' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('calls onChange with the clicked id', async () => {
    const onChange = vi.fn();
    render(<PixelTabs items={ITEMS} value="a" onChange={onChange} label="Main menu" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('does not call onChange for a disabled tab', async () => {
    const onChange = vi.fn();
    render(<PixelTabs items={ITEMS} value="a" onChange={onChange} label="Main menu" />);
    await userEvent.click(screen.getByRole('tab', { name: 'Script' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('moves selection with the arrow keys, skipping disabled tabs', async () => {
    const onChange = vi.fn();
    render(<PixelTabs items={ITEMS} value="b" onChange={onChange} label="Main menu" />);
    screen.getByRole('tab', { name: 'Chat' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('labels the tablist', () => {
    render(<PixelTabs items={ITEMS} value="a" onChange={() => {}} label="Main menu" />);
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Main menu');
  });
});
