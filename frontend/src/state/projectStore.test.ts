import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { Project } from '@/api/types';
import { useProjectStore } from './projectStore';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj1',
    name: 'Scene 1',
    createdAt: '2026-08-10T00:00:00+00:00',
    updatedAt: '2026-08-10T00:00:00+00:00',
    participantIds: [],
    turns: [],
    sequencer: { mode: 'sequential', delayMs: 300, staggerMs: 0, loop: false, volume: 1 },
    ...overrides,
  };
}

beforeEach(() => {
  useProjectStore.setState({
    summaries: [], current: null, loading: false, error: null, renderingTurnId: null,
  });
  vi.restoreAllMocks();
});

describe('projectStore', () => {
  it('opens a project and stores it as current', async () => {
    vi.spyOn(api, 'getProject').mockResolvedValue(makeProject());
    await useProjectStore.getState().open('proj1');
    expect(useProjectStore.getState().current?.id).toBe('proj1');
  });

  it('creates a project, refreshes summaries and opens it', async () => {
    vi.spyOn(api, 'createProject').mockResolvedValue(makeProject());
    vi.spyOn(api, 'listProjects').mockResolvedValue([
      { id: 'proj1', name: 'Scene 1', createdAt: 'x', updatedAt: 'x',
        turnCount: 0, renderedCount: 0, participantIds: [] },
    ]);
    await useProjectStore.getState().create('Scene 1');
    const state = useProjectStore.getState();
    expect(state.current?.id).toBe('proj1');
    expect(state.summaries).toHaveLength(1);
  });

  it('adds a turn and stores the returned project', async () => {
    useProjectStore.setState({ current: makeProject() });
    vi.spyOn(api, 'addTurn').mockResolvedValue(
      makeProject({
        participantIds: ['p1'],
        turns: [
          { id: 't1', profileId: 'p1', text: '', params: { numStep: 32, speed: 1, duration: null },
            voiceOverride: null, status: 'draft', audio: null,
            createdAt: 'x', updatedAt: 'x' },
        ],
      }),
    );
    await useProjectStore.getState().addTurn('p1');
    expect(useProjectStore.getState().current?.turns).toHaveLength(1);
  });

  it('tracks the rendering turn id while a render is in flight', async () => {
    useProjectStore.setState({ current: makeProject() });
    let seen: string | null = null;
    vi.spyOn(api, 'renderTurn').mockImplementation(async () => {
      seen = useProjectStore.getState().renderingTurnId;
      return makeProject();
    });
    await useProjectStore.getState().renderTurn('t1');
    expect(seen).toBe('t1');
    expect(useProjectStore.getState().renderingTurnId).toBeNull();
  });

  it('clears the rendering id and records the error when a render fails', async () => {
    useProjectStore.setState({ current: makeProject() });
    vi.spyOn(api, 'renderTurn').mockRejectedValue(new Error('synthesis failed'));
    await useProjectStore.getState().renderTurn('t1');
    const state = useProjectStore.getState();
    expect(state.renderingTurnId).toBeNull();
    expect(state.error).toBe('synthesis failed');
  });

  it('updates sequencer settings optimistically then from the server', async () => {
    useProjectStore.setState({ current: makeProject() });
    vi.spyOn(api, 'updateProject').mockResolvedValue(
      makeProject({
        sequencer: { mode: 'simultaneous', delayMs: 300, staggerMs: 120, loop: true, volume: 0.8 },
      }),
    );
    await useProjectStore.getState().setSequencer({ mode: 'simultaneous', staggerMs: 120 });
    expect(useProjectStore.getState().current?.sequencer.mode).toBe('simultaneous');
    expect(useProjectStore.getState().current?.sequencer.staggerMs).toBe(120);
  });

  it('renderedTurns returns only turns with audio, in order', () => {
    useProjectStore.setState({
      current: makeProject({
        turns: [
          { id: 't1', profileId: 'p1', text: 'a', params: { numStep: 32, speed: 1, duration: null },
            voiceOverride: null, status: 'draft', audio: null, createdAt: 'x', updatedAt: 'x' },
          { id: 't2', profileId: 'p1', text: 'b', params: { numStep: 32, speed: 1, duration: null },
            voiceOverride: null, status: 'rendered',
            audio: { url: '/media/b.wav', filename: 'b.wav', durationSec: 1,
                     sampleRate: 24000, renderedAt: 'x' },
            createdAt: 'x', updatedAt: 'x' },
        ],
      }),
    });
    expect(useProjectStore.getState().renderedTurns().map((t) => t.id)).toEqual(['t2']);
  });
});
