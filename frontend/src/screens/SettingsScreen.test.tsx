import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { ServerSettings } from '@/api/types';
import { DEFAULT_PREFS, useUiStore } from '@/state/uiStore';
import { useVocabStore } from '@/state/vocabStore';
import { SettingsScreen } from './SettingsScreen';

const SERVER: ServerSettings = {
  paths: {
    dataDir: 'C:\\GITHUB\\VoxRox\\data',
    profiles: 'C:\\GITHUB\\VoxRox\\data\\profiles',
    projects: 'C:\\GITHUB\\VoxRox\\data\\projects',
    portraits: 'C:\\GITHUB\\VoxRox\\data\\media\\portraits',
    samples: 'C:\\GITHUB\\VoxRox\\data\\media\\samples',
    renders: 'C:\\GITHUB\\VoxRox\\data\\media\\renders',
    previewTmp: 'C:\\GITHUB\\VoxRox\\data\\tmp\\preview',
  },
  audio: {
    sampleRate: 24000, channels: 1, format: 'WAV',
    encoding: 'PCM 16-bit', waveformBuckets: 160,
  },
  generation: {
    numStepMin: 16, numStepMax: 32, numStepDefault: 32,
    speedMin: 0.5, speedMax: 2, speedDefault: 1, durationMaxSec: 120,
  },
  env: { VOXROX_DEVICE: '(unset — cuda:0)' },
};

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  useUiStore.setState({ ...DEFAULT_PREFS });
  useVocabStore.setState({
    tagGroups: [
      { id: 'vocal', label: 'Vocal',
        tags: [{ token: '[sigh]', label: 'Sigh', description: 'Sigh.', hotkey: '2' }] },
    ],
    vocab: { genders: [], ages: [], pitches: [], styles: [],
             accents: [], dialects: [], moods: [], intensities: [] },
    engine: {
      model: 'k2-fsa/OmniVoice', device: 'cuda:0', dtype: 'float16',
      loaded: true, error: null, capabilities: ['auto', 'clone', 'design'],
    },
    loaded: true,
  });
  vi.spyOn(api, 'getEngineStatus').mockResolvedValue({
    model: 'k2-fsa/OmniVoice', device: 'cuda:0', dtype: 'float16',
    loaded: true, error: null, capabilities: ['auto', 'clone', 'design'],
  });
  vi.spyOn(api, 'getServerSettings').mockResolvedValue(SERVER);
});

describe('SettingsScreen', () => {
  it('offers every bundled font and marks the active one', async () => {
    render(<SettingsScreen />);
    expect(await screen.findByRole('button', { name: /Press Start 2P/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const name of ['Silkscreen', 'VT323', 'DotGothic16', 'System mono']) {
      expect(screen.getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it('switches the font and applies it to the document', async () => {
    render(<SettingsScreen />);
    await userEvent.click(screen.getByRole('button', { name: /VT323/ }));
    expect(useUiStore.getState().font).toBe('vt323');
    expect(document.documentElement.getAttribute('data-font')).toBe('vt323');
  });

  it('shows the glint rate as fps and sweep length', async () => {
    render(<SettingsScreen />);
    // 0.5s per frame over 24 frames
    expect(await screen.findByText('2.0 fps · 12.0s sweep')).toBeInTheDocument();
  });

  it('toggles scanlines and the glint', async () => {
    render(<SettingsScreen />);
    await userEvent.click(screen.getByRole('button', { name: /CRT scanlines/ }));
    expect(useUiStore.getState().scanlines).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: /Metal glint/ }));
    expect(useUiStore.getState().glintEnabled).toBe(false);
  });

  it('lists the real server paths for sessions, samples and renders', async () => {
    render(<SettingsScreen />);
    expect(await screen.findByText(SERVER.paths.projects)).toBeInTheDocument();
    expect(screen.getByText(SERVER.paths.renders)).toBeInTheDocument();
    expect(screen.getByText(SERVER.paths.samples)).toBeInTheDocument();
    expect(screen.getByText(SERVER.paths.previewTmp)).toBeInTheDocument();
  });

  it('reports the audio contract', async () => {
    render(<SettingsScreen />);
    expect(await screen.findByText('24000 Hz')).toBeInTheDocument();
    expect(screen.getByText('mono')).toBeInTheDocument();
    expect(screen.getByText('WAV · PCM 16-bit')).toBeInTheDocument();
    expect(screen.getByText('16–32 (default 32)')).toBeInTheDocument();
  });

  it('still shows engine status', async () => {
    render(<SettingsScreen />);
    expect(await screen.findByText('k2-fsa/OmniVoice')).toBeInTheDocument();
    expect(screen.getByTestId('engine-loaded')).toHaveTextContent('yes');
  });

  it('surfaces an unreachable server without blanking the screen', async () => {
    vi.spyOn(api, 'getServerSettings').mockRejectedValue(new Error('connection refused'));
    render(<SettingsScreen />);
    expect(await screen.findByText(/connection refused/)).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('resets appearance to defaults', async () => {
    render(<SettingsScreen />);
    await userEvent.click(screen.getByRole('button', { name: /DotGothic16/ }));
    await waitFor(() => expect(useUiStore.getState().font).toBe('dotgothic'));
    await userEvent.click(screen.getByRole('button', { name: 'Reset appearance' }));
    expect(useUiStore.getState().font).toBe('press-start');
  });
});
