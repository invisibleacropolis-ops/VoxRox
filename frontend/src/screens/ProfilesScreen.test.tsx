import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { Profile } from '@/api/types';
import { useProfileStore } from '@/state/profileStore';
import { useVocabStore } from '@/state/vocabStore';
import { ProfilesScreen } from './ProfilesScreen';

const VOCAB = {
  genders: ['', 'male', 'female'],
  ages: ['', 'child', 'teenage', 'young adult', 'middle-aged', 'elderly'],
  pitches: ['', 'very low', 'low', 'medium', 'high', 'very high'],
  styles: ['', 'whisper'],
  accents: ['', 'american', 'british'],
  dialects: ['', '四川话'],
  moods: ['', 'neutral', 'happy', 'angry'],
  intensities: ['faintly', 'slightly', '', 'very', 'extremely'],
};

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p1', name: 'Ivy', createdAt: 'x', updatedAt: 'x', portraitUrl: null,
    card: { shortName: 'Ivy', tagline: '', accentColor: '#f2c14e' },
    voiceMode: 'auto',
    voice: { gender: '', age: '', pitch: '', style: '', accent: '',
             dialect: '', mood: '', intensity: 2, extra: [] },
    params: { numStep: 32, speed: 1, duration: null },
    samples: [], activeSampleId: null,
    narrative: { description: '', background: '' },
    customTags: [], archive: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  useVocabStore.setState({ tagGroups: [], vocab: VOCAB, engine: null, loaded: true });
  useProfileStore.setState({
    profiles: [], selectedId: null, loading: false, error: null,
  });
});

describe('ProfilesScreen', () => {
  it('prompts to create a profile when there are none', () => {
    render(<ProfilesScreen />);
    expect(screen.getByText(/no profiles yet/i)).toBeInTheDocument();
  });

  it('creates a profile from the new-profile control', async () => {
    const spy = vi.spyOn(api, 'createProfile').mockResolvedValue(makeProfile());
    render(<ProfilesScreen />);
    await userEvent.type(screen.getByLabelText('New profile name'), 'Ivy');
    await userEvent.click(screen.getByRole('button', { name: 'New' }));
    expect(spy).toHaveBeenCalledWith('Ivy');
  });

  it('shows the editor for the selected profile', () => {
    useProfileStore.setState({ profiles: [makeProfile()], selectedId: 'p1' });
    render(<ProfilesScreen />);
    expect(screen.getByLabelText('Character name')).toHaveValue('Ivy');
    expect(screen.getByText('Profile Settings')).toBeInTheDocument();
    expect(screen.getByText('Character description and narrative background')).toBeInTheDocument();
    expect(screen.getByText('Generated audio archive')).toBeInTheDocument();
  });

  it('patches the name on blur', async () => {
    useProfileStore.setState({ profiles: [makeProfile()], selectedId: 'p1' });
    const spy = vi
      .spyOn(api, 'updateProfile')
      .mockResolvedValue(makeProfile({ name: 'Ivy Thorn' }));
    render(<ProfilesScreen />);
    const input = screen.getByLabelText('Character name');
    await userEvent.clear(input);
    await userEvent.type(input, 'Ivy Thorn');
    await userEvent.tab();
    await waitFor(() => expect(spy).toHaveBeenCalledWith('p1', { name: 'Ivy Thorn' }));
  });

  it('patches the voice mode from the settings panel', async () => {
    useProfileStore.setState({ profiles: [makeProfile()], selectedId: 'p1' });
    const spy = vi
      .spyOn(api, 'updateProfile')
      .mockResolvedValue(makeProfile({ voiceMode: 'design' }));
    render(<ProfilesScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'design' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('p1', { voiceMode: 'design' }));
  });

  it('uploads a voice sample', async () => {
    useProfileStore.setState({ profiles: [makeProfile()], selectedId: 'p1' });
    const spy = vi.spyOn(api, 'uploadSample').mockResolvedValue(makeProfile());
    render(<ProfilesScreen />);
    const file = new File(['x'], 'ref.wav', { type: 'audio/wav' });
    await userEvent.upload(screen.getByTestId('sample-input'), file);
    await waitFor(() => expect(spy).toHaveBeenCalledWith('p1', file, ''));
  });

  it('lists uploaded samples with an active marker', () => {
    useProfileStore.setState({
      profiles: [
        makeProfile({
          activeSampleId: 's1',
          samples: [
            { id: 's1', filename: 'ref.wav', url: '/media/samples/p1/s1.wav',
              transcript: 'hello', durationSec: 2, addedAt: 'x' },
          ],
        }),
      ],
      selectedId: 'p1',
    });
    render(<ProfilesScreen />);
    expect(screen.getByText('ref.wav')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Use ref.wav for cloning' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders archive rows', () => {
    useProfileStore.setState({
      profiles: [
        makeProfile({
          archive: [
            { id: 'a1', projectId: 'proj1', projectName: 'Scene 1', turnId: 't1',
              text: 'Hello [laughter] world', url: '/media/renders/proj1/t1.wav',
              durationSec: 1.5, createdAt: '2026-08-10T00:00:00+00:00' },
          ],
        }),
      ],
      selectedId: 'p1',
    });
    render(<ProfilesScreen />);
    const row = screen.getByTestId('archive-text');
    expect(row).toHaveTextContent('Hello world');
    expect(row).toHaveTextContent('Scene 1');
  });
});
