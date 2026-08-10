import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import { useProfileStore } from '@/state/profileStore';
import { useProjectStore } from '@/state/projectStore';
import { useVocabStore } from '@/state/vocabStore';
import App from './App';

const VOCAB = {
  genders: [''], ages: [''], pitches: [''], styles: [''],
  accents: [''], dialects: [''], moods: [''], intensities: [''],
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, 'getTags').mockResolvedValue({ groups: [] });
  vi.spyOn(api, 'getVoiceVocab').mockResolvedValue(VOCAB);
  vi.spyOn(api, 'getEngineStatus').mockResolvedValue({
    model: 'k2-fsa/OmniVoice', device: 'cuda:0', dtype: 'float16',
    loaded: false, error: null, capabilities: ['auto', 'clone', 'design'],
  });
  vi.spyOn(api, 'listProfiles').mockResolvedValue([]);
  vi.spyOn(api, 'listProjects').mockResolvedValue([]);
  useVocabStore.setState({ tagGroups: [], vocab: VOCAB, engine: null, loaded: false });
  useProfileStore.setState({ profiles: [], selectedId: null, loading: false, error: null });
  useProjectStore.setState({
    summaries: [], current: null, loading: false, error: null, renderingTurnId: null,
  });
});

describe('App', () => {
  it('renders the four main menu entries', () => {
    render(<App />);
    for (const label of ['Profiles', 'Chat', 'Script', 'Settings']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
  });

  it('opens on the Profiles screen', () => {
    render(<App />);
    expect(screen.getByRole('tab', { name: 'Profiles' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('Characters')).toBeInTheDocument();
  });

  it('always shows the sequencer bar under the menu', () => {
    render(<App />);
    expect(screen.getByTestId('sequencer-bar')).toBeInTheDocument();
  });

  it('loads vocabulary and profiles on mount', async () => {
    render(<App />);
    await waitFor(() => expect(api.getTags).toHaveBeenCalled());
    await waitFor(() => expect(api.listProfiles).toHaveBeenCalled());
  });

  it('switches to the Chat screen', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Chat' }));
    expect(await screen.findByLabelText('New project name')).toBeInTheDocument();
  });

  it('switches to the Script placeholder', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Script' }));
    expect(screen.getByText(/later pass/i)).toBeInTheDocument();
  });

  it('switches to Settings and shows engine info', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(await screen.findByText('k2-fsa/OmniVoice')).toBeInTheDocument();
    expect(screen.getByTestId('engine-loaded')).toHaveTextContent('no');
  });

  it('applies the CRT overlay class to the app root', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.vx-app')).toHaveClass('vx-crt');
  });
});
