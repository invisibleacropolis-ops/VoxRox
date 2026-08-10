import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { Project, Turn } from '@/api/types';
import { useProjectStore } from '@/state/projectStore';
import { useSequencerStore } from '@/state/sequencerStore';
import { SequencerBar } from './SequencerBar';

const RENDERED: Turn = {
  id: 't1', profileId: 'p1', text: 'Hi',
  params: { numStep: 32, speed: 1, duration: null },
  voiceOverride: null, status: 'rendered',
  audio: { url: '/media/renders/proj1/t1.wav', filename: 't1.wav',
           durationSec: 1.5, sampleRate: 24000, peaks: [0.2, 0.9, 0.4], renderedAt: 'x' },
  createdAt: 'x', updatedAt: 'x',
};

const DRAFT: Turn = { ...RENDERED, id: 't2', status: 'draft', audio: null };

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj1', name: 'Scene 1', createdAt: 'x', updatedAt: 'x',
    participantIds: ['p1'], turns: [RENDERED, DRAFT],
    sequencer: { mode: 'sequential', delayMs: 300, staggerMs: 0, loop: false, volume: 1 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  useProjectStore.setState({
    summaries: [], current: makeProject(), loading: false, error: null, renderingTurnId: null,
  });
  useSequencerStore.setState({ playing: false, index: 0, activeTurnIds: [] });
});

describe('SequencerBar', () => {
  it('renders the transport controls', () => {
    render(<SequencerBar />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });

  it('feeds only rendered turns into the engine', () => {
    const spy = vi.spyOn(useSequencerStore.getState().engine, 'setItems');
    render(<SequencerBar />);
    expect(spy).toHaveBeenCalledWith([
      { turnId: 't1', url: '/media/renders/proj1/t1.wav', durationSec: 1.5 },
    ]);
  });

  it('reports how many clips are queued', () => {
    render(<SequencerBar />);
    expect(screen.getByText(/1 clip queued/)).toBeInTheDocument();
  });

  it('starts playback', async () => {
    const spy = vi.spyOn(useSequencerStore.getState().engine, 'play');
    render(<SequencerBar />);
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(spy).toHaveBeenCalled();
  });

  it('swaps Play for Pause while playing', () => {
    useSequencerStore.setState({ playing: true });
    render(<SequencerBar />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  });

  it('stops playback', async () => {
    const spy = vi.spyOn(useSequencerStore.getState().engine, 'stop');
    render(<SequencerBar />);
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(spy).toHaveBeenCalled();
  });

  it('switches to simultaneous mode and persists it', async () => {
    const spy = vi.spyOn(api, 'updateProject').mockResolvedValue(makeProject());
    render(<SequencerBar />);
    await userEvent.click(screen.getByRole('button', { name: 'simultaneous' }));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('proj1', {
        sequencer: { mode: 'simultaneous' },
      }),
    );
  });

  it('changes the gap delay', async () => {
    const spy = vi.spyOn(api, 'updateProject').mockResolvedValue(makeProject());
    render(<SequencerBar />);
    fireEvent.change(screen.getByLabelText(/Gap/), { target: { value: '900' } });
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('proj1', { sequencer: { delayMs: 900 } }),
    );
  });

  it('changes the stagger', async () => {
    const spy = vi.spyOn(api, 'updateProject').mockResolvedValue(makeProject());
    render(<SequencerBar />);
    fireEvent.change(screen.getByLabelText(/Stagger/), { target: { value: '250' } });
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('proj1', { sequencer: { staggerMs: 250 } }),
    );
  });

  it('changes the volume', async () => {
    const spy = vi.spyOn(api, 'updateProject').mockResolvedValue(makeProject());
    render(<SequencerBar />);
    fireEvent.change(screen.getByLabelText(/Volume/), { target: { value: '0.5' } });
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('proj1', { sequencer: { volume: 0.5 } }),
    );
  });

  it('toggles loop', async () => {
    const spy = vi.spyOn(api, 'updateProject').mockResolvedValue(makeProject());
    render(<SequencerBar />);
    await userEvent.click(screen.getByRole('button', { name: 'Loop' }));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith('proj1', { sequencer: { loop: true } }),
    );
  });

  it('disables the transport when nothing is rendered', () => {
    useProjectStore.setState({ current: makeProject({ turns: [DRAFT] }) });
    render(<SequencerBar />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });

  it('dims itself and disables Play when no project is open', () => {
    useProjectStore.setState({ current: null });
    render(<SequencerBar />);
    expect(screen.getByTestId('sequencer-bar')).toHaveAttribute('data-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
  });
});
