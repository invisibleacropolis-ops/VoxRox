import { act, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
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

  it('latches the press state on pointer down and clears it when the animation ends', () => {
    render(<PixelButton>Render</PixelButton>);
    const button = screen.getByRole('button', { name: 'Render' });
    expect(button).not.toHaveAttribute('data-pressing');
    fireEvent.pointerDown(button);
    expect(button).toHaveAttribute('data-pressing', 'true');
    fireEvent.animationEnd(button);
    expect(button).not.toHaveAttribute('data-pressing');
  });

  it('releases the press on a timer even if animationend never fires', () => {
    // prefers-reduced-motion suppresses the animation, so animationend never
    // arrives — without the timer the button would stay latched forever.
    vi.useFakeTimers();
    try {
      render(<PixelButton>Render</PixelButton>);
      const button = screen.getByRole('button', { name: 'Render' });
      fireEvent.pointerDown(button);
      expect(button).toHaveAttribute('data-pressing', 'true');
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(button).not.toHaveAttribute('data-pressing');
    } finally {
      vi.useRealTimers();
    }
  });

  it('restarts the latch when pressed again mid-animation', () => {
    vi.useFakeTimers();
    try {
      render(<PixelButton>Render</PixelButton>);
      const button = screen.getByRole('button', { name: 'Render' });
      fireEvent.pointerDown(button);
      act(() => {
        vi.advanceTimersByTime(150);
      });
      fireEvent.pointerDown(button);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      // The first timer must not cut the second press short.
      expect(button).toHaveAttribute('data-pressing', 'true');
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(button).not.toHaveAttribute('data-pressing');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not latch a press on a disabled button', () => {
    render(<PixelButton disabled>Render</PixelButton>);
    const button = screen.getByRole('button', { name: 'Render' });
    fireEvent.pointerDown(button);
    expect(button).not.toHaveAttribute('data-pressing');
  });

  it('still forwards a caller onPointerDown', () => {
    const onPointerDown = vi.fn();
    render(<PixelButton onPointerDown={onPointerDown}>Render</PixelButton>);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Render' }));
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });

  it('exposes aria-pressed when selected', () => {
    render(<PixelButton selected>Ivy</PixelButton>);
    expect(screen.getByRole('button', { name: 'Ivy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
