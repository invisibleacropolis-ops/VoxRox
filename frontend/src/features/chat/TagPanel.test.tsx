import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVocabStore } from '@/state/vocabStore';
import { TagPanel } from './TagPanel';

const GROUPS = [
  {
    id: 'vocal',
    label: 'Vocal',
    tags: [
      { token: '[laughter]', label: 'Laugh', description: 'Audible laughter.', hotkey: '1' },
      { token: '[sigh]', label: 'Sigh', description: 'Audible exhaled sigh.', hotkey: '2' },
    ],
  },
  {
    id: 'surprise',
    label: 'Surprise',
    tags: [
      { token: '[surprise-ah]', label: 'Ah!', description: 'Surprised ah.', hotkey: 'A' },
    ],
  },
];

beforeEach(() => {
  useVocabStore.setState({
    tagGroups: GROUPS,
    vocab: {
      genders: [], ages: [], pitches: [], styles: [],
      accents: [], dialects: [], moods: [], intensities: [],
    },
    engine: null,
    loaded: true,
  });
});

describe('TagPanel', () => {
  it('renders every group heading', () => {
    render(<TagPanel onInsert={() => {}} />);
    expect(screen.getByText('Vocal')).toBeInTheDocument();
    expect(screen.getByText('Surprise')).toBeInTheDocument();
  });

  it('renders one button per tag showing its label', () => {
    render(<TagPanel onInsert={() => {}} />);
    expect(screen.getByRole('button', { name: /Laugh/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ah!/ })).toBeInTheDocument();
  });

  it('emits the token on click', async () => {
    const onInsert = vi.fn();
    render(<TagPanel onInsert={onInsert} />);
    await userEvent.click(screen.getByRole('button', { name: /Laugh/ }));
    expect(onInsert).toHaveBeenCalledWith('[laughter]');
  });

  it('exposes the hotkey and description as the title', () => {
    render(<TagPanel onInsert={() => {}} />);
    expect(screen.getByRole('button', { name: /Sigh/ })).toHaveAttribute(
      'title',
      'Audible exhaled sigh. (Alt+2)',
    );
  });

  it('inserts on Alt+hotkey', async () => {
    const onInsert = vi.fn();
    render(<TagPanel onInsert={onInsert} />);
    await userEvent.keyboard('{Alt>}2{/Alt}');
    expect(onInsert).toHaveBeenCalledWith('[sigh]');
  });

  it('ignores hotkeys when disabled', async () => {
    const onInsert = vi.fn();
    render(<TagPanel onInsert={onInsert} disabled />);
    await userEvent.keyboard('{Alt>}2{/Alt}');
    expect(onInsert).not.toHaveBeenCalled();
  });
});
