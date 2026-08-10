import { create } from 'zustand';
import { api } from '@/api/client';
import type { DeepPartial, Profile } from '@/api/types';

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface ProfileState {
  profiles: Profile[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (name: string) => Promise<void>;
  update: (id: string, patch: DeepPartial<Profile>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  select: (id: string | null) => void;
  applyProfile: (profile: Profile) => void;
  byId: (id: string) => Profile | undefined;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  selectedId: null,
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      set({ profiles: await api.listProfiles(), loading: false });
    } catch (error) {
      set({ error: message(error), loading: false });
    }
  },

  create: async (name) => {
    set({ error: null });
    try {
      const profile = await api.createProfile(name);
      set((state) => ({
        profiles: [...state.profiles, profile],
        selectedId: profile.id,
      }));
    } catch (error) {
      set({ error: message(error) });
    }
  },

  update: async (id, patch) => {
    set({ error: null });
    try {
      get().applyProfile(await api.updateProfile(id, patch));
    } catch (error) {
      set({ error: message(error) });
    }
  },

  remove: async (id) => {
    set({ error: null });
    try {
      await api.deleteProfile(id);
      set((state) => ({
        profiles: state.profiles.filter((p) => p.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      }));
    } catch (error) {
      set({ error: message(error) });
    }
  },

  select: (id) => set({ selectedId: id }),

  applyProfile: (profile) =>
    set((state) => ({
      profiles: state.profiles.some((p) => p.id === profile.id)
        ? state.profiles.map((p) => (p.id === profile.id ? profile : p))
        : [...state.profiles, profile],
    })),

  byId: (id) => get().profiles.find((p) => p.id === id),
}));
