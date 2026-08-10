import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { Profile, Turn } from '@/api/types';
import { useVocabStore } from '@/state/vocabStore';
import { TurnEditor } from './TurnEditor';

const PROFILE: Profile = {
  id: 'p1', name: 'Ivy', createdAt: 'x', updatedAt: 'x', portraitUrl: null,
  card: { shortName: 'Ivy', tagline: '', accentColor: '#f2c14e' },
  voiceMode: 'auto',
  voice: { gender: '', age: '', pitch: '', style: '', accent: '',
           dialect: '', mood: '', intensity: 2, extra: [] },
  params: { numStep: 32, speed: 1, duration: null },
  samples: [], activeSampleId: null,
  narrative: { description: '', background: '' },
  customTags: [], archive: [],
};

const TURN: Turn = {
  id: 't1', profileId: 'p1', text: '',
  params: { numStep: 32, speed: 1, duration: null },
  voiceOverride: null, status: 'draft', audio: null,
  createdAt: 'x', updatedAt: 'x',
};

beforeEach(() => {
  vi.restoreAllMocks();
  useVocabStore.setState({
    tagGroups: [
      { id: 'vocal', label: 'Vocal',
        tags: [{ token: '[sigh]', label: 'Sigh', description: 'Sigh.', hotkey: '2' }] },
    ],
    vocab: {
      genders: [], ages: [], pitches: [], styles: [],
      accents: [], dialects: [], moods: [], intensities: [],
    },
    engine: null,
    loaded: true,
  });
});

function renderEditor(overrides: Record<string, unknown> = {}) {
  const props = {
    open: true,
    turn: TURN,
    profile: PROFILE,
    rendering: false,
    onSave: vi.fn().mockResolvedValue(undefined),
    onRender: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  } as Parameters<typeof TurnEditor>[0] & {
    onSave: ReturnType<typeof vi.fn>;
    onRender: ReturnType<typeof vi.fn>;
    onClose: ReturnType<typeof vi.fn>;
  };
  render(<TurnEditor {...props} />);
  return props;
}

describe('TurnEditor', () => {
  it('shows the character name in the title bar', () => {
    renderEditor();
    expect(screen.getByText(/Ivy/)).toBeInTheDocument();
  });

  it('types into the expanding text area', async () => {
    renderEditor();
    const area = screen.getByLabelText('Turn text');
    await userEvent.type(area, 'Hello');
    expect(area).toHaveValue('Hello');
  });

  it('inserts a tag at the caret from the tag panel', async () => {
    renderEditor();
    const area = screen.getByLabelText('Turn text') as HTMLTextAreaElement;
    await userEvent.type(area, 'Hello');
    await userEvent.click(screen.getByRole('button', { name: /Sigh/ }));
    expect(area).toHaveValue('Hello [sigh] ');
  });

  it('disables Preview and Render while the text is blank', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Render' })).toBeDisabled();
  });

  it('requests a preview with the current text and params', async () => {
    const spy = vi
      .spyOn(api, 'createPreview')
      .mockResolvedValue({ url: '/api/preview/abc', durationSec: 1.5, peaks: [] });
    renderEditor();
    await userEvent.type(screen.getByLabelText('Turn text'), 'Hi');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        profileId: 'p1',
        text: 'Hi',
        params: { numStep: 32, speed: 1, duration: null },
      }),
    );
  });

  it('loads the preview into the transport', async () => {
    vi.spyOn(api, 'createPreview').mockResolvedValue({
      url: '/api/preview/abc',
      durationSec: 1.5,
      peaks: [0.3, 0.8, 0.5],
    });
    renderEditor();
    await userEvent.type(screen.getByLabelText('Turn text'), 'Hi');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await waitFor(() =>
      expect(document.querySelector('audio')).toHaveAttribute('src', '/api/preview/abc'),
    );
  });

  it('surfaces a preview error', async () => {
    vi.spyOn(api, 'createPreview').mockRejectedValue(new Error('unknown tags: [wobble]'));
    renderEditor();
    await userEvent.type(screen.getByLabelText('Turn text'), 'Hi');
    await userEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByText('unknown tags: [wobble]')).toBeInTheDocument();
  });

  it('saves then renders when Render is pressed', async () => {
    const props = renderEditor();
    await userEvent.type(screen.getByLabelText('Turn text'), 'Hi');
    await userEvent.click(screen.getByRole('button', { name: 'Render' }));
    await waitFor(() =>
      expect(props.onSave).toHaveBeenCalledWith({
        text: 'Hi',
        params: { numStep: 32, speed: 1, duration: null },
      }),
    );
    await waitFor(() => expect(props.onRender).toHaveBeenCalled());
  });

  it('marks Render busy while a render is in flight', () => {
    renderEditor({ rendering: true, turn: { ...TURN, text: 'Hi' } });
    expect(screen.getByRole('button', { name: 'Render' })).toBeDisabled();
  });

  it('exposes the fine-tune sliders', () => {
    renderEditor({ turn: { ...TURN, text: 'Hi' } });
    expect(screen.getAllByRole('slider')).toHaveLength(3);
    expect(screen.getByText('auto')).toBeInTheDocument();
  });

  it('saves and closes on Save & close', async () => {
    const props = renderEditor({ turn: { ...TURN, text: 'Hi' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save & close' }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });
});
