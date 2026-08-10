import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PixelButton } from './PixelButton';

describe('PixelButton', () => {
  it('renders its label and fires onClick', async () => {
    const onClick = vi.fn();
    render(<PixelButton onClick={onClick}>Render</PixelButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Render' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onClick = vi.fn();
    render(
      <PixelButton disabled onClick={onClick}>
        Render
      </PixelButton>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Render' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('applies the variant and size classes', () => {
    render(
      <PixelButton variant="danger" size="sm">
        Delete
      </PixelButton>,
    );
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveClass('vx-btn', 'vx-btn--danger', 'vx-btn--sm');
  });

  it('marks itself busy and blocks clicks while busy', async () => {
    const onClick = vi.fn();
    render(
      <PixelButton busy onClick={onClick}>
        Render
      </PixelButton>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveClass('vx-anim-busy');
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('exposes aria-pressed when selected', () => {
    render(<PixelButton selected>Ivy</PixelButton>);
    expect(screen.getByRole('button', { name: 'Ivy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
