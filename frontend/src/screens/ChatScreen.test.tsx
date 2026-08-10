import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { Profile, Project, Turn } from '@/api/types';
import { useProfileStore } from '@/state/profileStore';
import { useProjectStore } from '@/state/projectStore';
import { useVocabStore } from '@/state/vocabStore';
import { ChatScreen } from './ChatScreen';

function makeProfile(id = 'p1', name = 'Ivy'): Profile {
  return {
    id, name, createdAt: 'x', updatedAt: 'x', portraitUrl: null,
    card: { shortName: name, tagline: '', accentColor: '#f2c14e' },
    voiceMode: 'auto',
    voice: { gender: '', age: '', pitch: '', style: '', accent: '',
             dialect: '', mood: '', intensity: 2, extra: [] },
    params: { numStep: 32, speed: 1, duration: null },
    samples: [], activeSampleId: null,
    narrative: { description: '', background: '' },
    customTags: [], archive: [],
  };
}

const TURN: Turn = {
  id: 't1', profileId: 'p1', text: 'Hello there',
  params: { numStep: 32, speed: 1, duration: null },
  voiceOverride: null, status: 'rendered',
  audio: { url: '/media/renders/proj1/t1.wav', filename: 't1.wav',
           durationSec: 1.5, sampleRate: 24000, peaks: [0.2, 0.9, 0.4], renderedAt: 'x' },
  createdAt: 'x', updatedAt: 'x',
};

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj1', name: 'Scene 1', createdAt: 'x', updatedAt: 'x',
    participantIds: [], turns: [],
    sequencer: { mode: 'sequential', delayMs: 300, staggerMs: 0, loop: false, volume: 1 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  useVocabStore.setState({
    tagGroups: [], loaded: true, engine: null,
    vocab: { genders: [], ages: [], pitches: [], styles: [],
             accents: [], dialects: [], moods: [], intensities: [] },
  });
  useProfileStore.setState({
    profiles: [makeProfile()], selectedId: null, loading: false, error: null,
  });
  useProjectStore.setState({
    summaries: [], current: null, loading: false, error: null, renderingTurnId: null,
  });
  vi.spyOn(api, 'listProjects').mockResolvedValue([]);
});

describe('ChatScreen', () => {
  it('prompts to create a project when none is open', () => {
    render(<ChatScreen />);
    expect(screen.getByLabelText('New project name')).toBeInTheDocument();
  });

  it('creates a project', async () => {
    const spy = vi.spyOn(api, 'createProject').mockResolvedValue(makeProject());
    render(<ChatScreen />);
    await userEvent.type(screen.getByLabelText('New project name'), 'Scene 1');
    await userEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(spy).toHaveBeenCalledWith('Scene 1');
  });

  it('starts blank with an Add button in the corner', () => {
    useProjectStore.setState({ current: makeProject() });
    render(<ChatScreen />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByText(/no turns yet/i)).toBeInTheDocument();
  });

  it('opens the profile picker from Add', async () => {
    useProjectStore.setState({ current: makeProject() });
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('dialog', { name: 'Choose a character' })).toBeInTheDocument();
  });

  it('adds a turn for the picked profile and opens the editor', async () => {
    useProjectStore.setState({ current: makeProject() });
    vi.spyOn(api, 'addTurn').mockResolvedValue(
      makeProject({
        participantIds: ['p1'],
        turns: [{ ...TURN, status: 'draft', audio: null, text: '' }],
      }),
    );
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await userEvent.click(screen.getByRole('button', { name: /Ivy/ }));
    expect(await screen.findByLabelText('Turn text')).toBeInTheDocument();
  });

  it('shows participant cards in the left rail', () => {
    useProjectStore.setState({
      current: makeProject({ participantIds: ['p1'], turns: [TURN] }),
    });
    render(<ChatScreen />);
    expect(screen.getAllByTestId('profile-card').length).toBeGreaterThan(0);
  });

  it('shows rendered turns in the log with their audio', () => {
    useProjectStore.setState({
      current: makeProject({ participantIds: ['p1'], turns: [TURN] }),
    });
    const { container } = render(<ChatScreen />);
    expect(screen.getByTestId('turn-text')).toHaveTextContent('Hello there');
    expect(container.querySelector('audio')).toHaveAttribute(
      'src',
      '/media/renders/proj1/t1.wav',
    );
  });

  it('deletes a turn', async () => {
    useProjectStore.setState({
      current: makeProject({ participantIds: ['p1'], turns: [TURN] }),
    });
    const spy = vi.spyOn(api, 'deleteTurn').mockResolvedValue(makeProject());
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(spy).toHaveBeenCalledWith('proj1', 't1');
  });

  it('reopens the editor from a turn Edit button', async () => {
    useProjectStore.setState({
      current: makeProject({ participantIds: ['p1'], turns: [TURN] }),
    });
    render(<ChatScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByLabelText('Turn text')).toHaveValue('Hello there');
  });

  it('shows a store error banner', async () => {
    useProjectStore.setState({ current: makeProject() });
    render(<ChatScreen />);
    // The mount effect runs loadSummaries, which clears `error`; set it after.
    await act(async () => {
      useProjectStore.setState({ error: 'synthesis failed' });
    });
    expect(screen.getByText('synthesis failed')).toBeInTheDocument();
  });

  it('dismisses the error banner', async () => {
    useProjectStore.setState({ current: makeProject() });
    render(<ChatScreen />);
    await act(async () => {
      useProjectStore.setState({ error: 'synthesis failed' });
    });
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('synthesis failed')).not.toBeInTheDocument();
  });
});
