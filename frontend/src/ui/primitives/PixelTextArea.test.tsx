import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PixelTextArea } from './PixelTextArea';

describe('PixelTextArea', () => {
  it('reports each edit as the full next value', async () => {
    const onChange = vi.fn();
    // Fully controlled with a value the test never advances, so React resets
    // the DOM after every keystroke: each call carries one character.
    render(<PixelTextArea value="" onChange={onChange} aria-label="Turn text" />);
    await userEvent.type(screen.getByLabelText('Turn text'), 'Hi');
    expect(onChange.mock.calls.map((call) => call[0])).toEqual(['H', 'i']);
  });

  it('renders the value it is given', () => {
    render(<PixelTextArea value="Hello" onChange={() => {}} aria-label="Turn text" />);
    expect(screen.getByLabelText('Turn text')).toHaveValue('Hello');
  });

  it('applies min and max row bounds as inline heights', () => {
    render(
      <PixelTextArea value="" onChange={() => {}} minRows={3} maxRows={10} aria-label="Turn text" />,
    );
    const area = screen.getByLabelText('Turn text');
    expect(area.style.minHeight).not.toBe('');
    expect(area.style.maxHeight).not.toBe('');
  });

  it('forwards a ref to the underlying textarea', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<PixelTextArea ref={ref} value="x" onChange={() => {}} aria-label="Turn text" />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    expect(ref.current!.value).toBe('x');
  });

  it('shows the placeholder when empty', () => {
    render(
      <PixelTextArea value="" onChange={() => {}} placeholder="Speak..." aria-label="Turn text" />,
    );
    expect(screen.getByPlaceholderText('Speak...')).toBeInTheDocument();
  });
});
