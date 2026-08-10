import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PixelWindow } from './PixelWindow';

describe('PixelWindow', () => {
  it('renders nothing when closed', () => {
    render(
      <PixelWindow open={false} title="Editor">
        body
      </PixelWindow>,
    );
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('renders title and body when open with the open animation', () => {
    render(
      <PixelWindow open title="Editor">
        body
      </PixelWindow>,
    );
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveClass('vx-anim-open');
  });

  it('calls onClose from the close button', async () => {
    const onClose = vi.fn();
    render(
      <PixelWindow open title="Editor" onClose={onClose}>
        body
      </PixelWindow>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close Editor' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn();
    render(
      <PixelWindow open title="Editor" onClose={onClose}>
        body
      </PixelWindow>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a backdrop only in modal mode', () => {
    const { rerender, container } = render(
      <PixelWindow open title="Picker" modal>
        body
      </PixelWindow>,
    );
    expect(container.querySelector('.vx-window-backdrop')).toBeTruthy();
    rerender(
      <PixelWindow open title="Picker">
        body
      </PixelWindow>,
    );
    expect(container.querySelector('.vx-window-backdrop')).toBeFalsy();
  });

  it('renders footer content when provided', () => {
    render(
      <PixelWindow open title="Editor" footer={<span>foot</span>}>
        body
      </PixelWindow>,
    );
    expect(screen.getByText('foot')).toBeInTheDocument();
  });

  it('omits the close button when onClose is absent', () => {
    render(
      <PixelWindow open title="Editor">
        body
      </PixelWindow>,
    );
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });
});
