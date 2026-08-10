import { create } from 'zustand';
import { api } from '@/api/client';
import type {
  GenerationParams,
  Project,
  ProjectSummary,
  SequencerSettings,
  Turn,
  VoiceDesign,
} from '@/api/types';

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ProjectState {
  summaries: ProjectSummary[];
  current: Project | null;
  loading: boolean;
  error: string | null;
  renderingTurnId: string | null;
  loadSummaries: () => Promise<void>;
  open: (id: string) => Promise<void>;
  create: (name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addTurn: (profileId: string, text?: string) => Promise<string | null>;
  updateTurn: (
    turnId: string,
    patch: {
      text?: string;
      params?: Partial<GenerationParams>;
      voiceOverride?: VoiceDesign | null;
    },
  ) => Promise<void>;
  deleteTurn: (turnId: string) => Promise<void>;
  reorderTurns: (turnIds: string[]) => Promise<void>;
  renderTurn: (turnId: string) => Promise<void>;
  setSequencer: (patch: Partial<SequencerSettings>) => Promise<void>;
  clearError: () => void;
  renderedTurns: () => Turn[];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  summaries: [],
  current: null,
  loading: false,
  error: null,
  renderingTurnId: null,

  loadSummaries: async () => {
    set({ loading: true, error: null });
    try {
      set({ summaries: await api.listProjects(), loading: false });
    } catch (error) {
      set({ error: message(error), loading: false });
    }
  },

  open: async (id) => {
    set({ loading: true, error: null });
    try {
      set({ current: await api.getProject(id), loading: false });
    } catch (error) {
      set({ error: message(error), loading: false });
    }
  },

  create: async (name) => {
    set({ error: null });
    try {
      const project = await api.createProject(name);
      set({ current: project });
      await get().loadSummaries();
    } catch (error) {
      set({ error: message(error) });
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await api.deleteProject(id);
      set((state) => ({ current: state.current?.id === id ? null : state.current }));
      await get().loadSummaries();
    } catch (error) {
      set({ error: message(error) });
    }
  },

  addTurn: async (profileId, text = '') => {
    const project = get().current;
    if (!project) return null;
    set({ error: null });
    try {
      const updated = await api.addTurn(project.id, profileId, text);
      set({ current: updated });
      return updated.turns.at(-1)?.id ?? null;
    } catch (error) {
      set({ error: message(error) });
      return null;
    }
  },

  updateTurn: async (turnId, patch) => {
    const project = get().current;
    if (!project) return;
    set({ error: null });
    try {
      set({ current: await api.updateTurn(project.id, turnId, patch) });
    } catch (error) {
      set({ error: message(error) });
    }
  },

  deleteTurn: async (turnId) => {
    const project = get().current;
    if (!project) return;
    try {
      set({ current: await api.deleteTurn(project.id, turnId) });
    } catch (error) {
      set({ error: message(error) });
    }
  },

  reorderTurns: async (turnIds) => {
    const project = get().current;
    if (!project) return;
    try {
      set({ current: await api.reorderTurns(project.id, turnIds) });
    } catch (error) {
      set({ error: message(error) });
    }
  },

  renderTurn: async (turnId) => {
    const project = get().current;
    if (!project) return;
    set({ renderingTurnId: turnId, error: null });
    try {
      set({ current: await api.renderTurn(project.id, turnId) });
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ renderingTurnId: null });
    }
  },

  setSequencer: async (patch) => {
    const project = get().current;
    if (!project) return;
    const optimistic = { ...project, sequencer: { ...project.sequencer, ...patch } };
    set({ current: optimistic });
    try {
      set({ current: await api.updateProject(project.id, { sequencer: patch }) });
    } catch (error) {
      set({ error: message(error) });
    }
  },

  clearError: () => set({ error: null }),

  renderedTurns: () => (get().current?.turns ?? []).filter((turn) => turn.audio !== null),
}));
