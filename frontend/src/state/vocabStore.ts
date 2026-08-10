import { create } from 'zustand';
import { api } from '@/api/client';
import type { EngineStatus, TagGroup, VoiceVocab } from '@/api/types';

const EMPTY_VOCAB: VoiceVocab = {
  genders: [], ages: [], pitches: [], styles: [],
  accents: [], dialects: [], moods: [], intensities: [],
};

interface VocabState {
  tagGroups: TagGroup[];
  vocab: VoiceVocab;
  engine: EngineStatus | null;
  loaded: boolean;
  load: () => Promise<void>;
  refreshEngine: () => Promise<void>;
  warmUp: () => Promise<void>;
}

export const useVocabStore = create<VocabState>((set) => ({
  tagGroups: [],
  vocab: EMPTY_VOCAB,
  engine: null,
  loaded: false,
  load: async () => {
    const [tags, vocab, engine] = await Promise.all([
      api.getTags(),
      api.getVoiceVocab(),
      api.getEngineStatus().catch(() => null),
    ]);
    set({ tagGroups: tags.groups, vocab, engine, loaded: true });
  },
  refreshEngine: async () => {
    set({ engine: await api.getEngineStatus() });
  },
  warmUp: async () => {
    set({ engine: await api.warmUpEngine() });
  },
}));
