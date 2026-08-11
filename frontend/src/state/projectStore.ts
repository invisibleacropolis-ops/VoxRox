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

/* ---------------------------------------------------------------------
   Session pointer. Turns themselves live on the server; what the browser
   has to remember is which session was open and which turn was being
   composed, so a reload lands back in the same place instead of the
   project list.
   --------------------------------------------------------------------- */
const SESSION_KEY = 'voxrox.session';

interface SessionPointer {
  projectId: string | null;
  editingTurnId: string | null;
}

export function loadSession(): SessionPointer {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { projectId: null, editingTurnId: null };
    const parsed = JSON.parse(raw) as Partial<SessionPointer>;
    return {
      projectId: parsed.projectId ?? null,
      editingTurnId: parsed.editingTurnId ?? null,
    };
  } catch {
    return { projectId: null, editingTurnId: null };
  }
}

function saveSession(pointer: SessionPointer): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(pointer));
  } catch {
    /* private mode — the session simply will not be restored next time */
  }
}

interface ProjectState {
  summaries: ProjectSummary[];
  current: Project | null;
  loading: boolean;
  error: string | null;
  renderingTurnId: string | null;
  /** Turn currently open in the editor; survives reloads. */
  editingTurnId: string | null;
  /** 'saving' while an autosave is in flight, 'saved' once it lands. */
  draftStatus: 'idle' | 'saving' | 'saved';
  loadSummaries: () => Promise<void>;
  open: (id: string) => Promise<void>;
  /** Reopen the session the browser was last in. */
  restoreSession: () => Promise<void>;
  close: () => void;
  setEditingTurn: (turnId: string | null) => void;
  saveDraft: (
    turnId: string,
    patch: { text?: string; params?: Partial<GenerationParams> },
  ) => Promise<void>;
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
  editingTurnId: null,
  draftStatus: 'idle',

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
      const project = await api.getProject(id);
      set({ current: project, loading: false, editingTurnId: null });
      saveSession({ projectId: project.id, editingTurnId: null });
    } catch (error) {
      set({ error: message(error), loading: false });
    }
  },

  restoreSession: async () => {
    const { projectId, editingTurnId } = loadSession();
    if (!projectId) return;
    set({ loading: true });
    try {
      const project = await api.getProject(projectId);
      // Only restore the editor if that turn still exists and is unrendered.
      const turn = project.turns.find((t) => t.id === editingTurnId);
      const resume = turn && turn.status === 'draft' ? turn.id : null;
      set({ current: project, loading: false, editingTurnId: resume });
      saveSession({ projectId: project.id, editingTurnId: resume });
    } catch {
      // Session pointed at a project that no longer exists. Drop the stale
      // pointer, but never clear a project the user already has open —
      // a failed restore must not destroy live state.
      saveSession({ projectId: null, editingTurnId: null });
      set({ loading: false });
    }
  },

  close: () => {
    set({ current: null, editingTurnId: null, draftStatus: 'idle' });
    saveSession({ projectId: null, editingTurnId: null });
  },

  setEditingTurn: (turnId) => {
    set({ editingTurnId: turnId, draftStatus: 'idle' });
    saveSession({ projectId: get().current?.id ?? null, editingTurnId: turnId });
  },

  saveDraft: async (turnId, patch) => {
    const project = get().current;
    if (!project) return;
    set({ draftStatus: 'saving' });
    try {
      set({ current: await api.updateTurn(project.id, turnId, patch) });
      set({ draftStatus: 'saved' });
    } catch (error) {
      set({ error: message(error), draftStatus: 'idle' });
    }
  },

  create: async (name) => {
    set({ error: null });
    try {
      const project = await api.createProject(name);
      set({ current: project, editingTurnId: null });
      saveSession({ projectId: project.id, editingTurnId: null });
      await get().loadSummaries();
    } catch (error) {
      set({ error: message(error) });
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await api.deleteProject(id);
      if (get().current?.id === id) {
        set({ current: null, editingTurnId: null });
        saveSession({ projectId: null, editingTurnId: null });
      }
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
      const turnId = updated.turns.at(-1)?.id ?? null;
      set({ current: updated, editingTurnId: turnId, draftStatus: 'idle' });
      saveSession({ projectId: project.id, editingTurnId: turnId });
      return turnId;
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
      if (get().editingTurnId === turnId) get().setEditingTurn(null);
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
      // The turn is no longer a draft, so the composer closes behind it.
      if (get().editingTurnId === turnId) get().setEditingTurn(null);
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
