import { create } from 'zustand';
import type { SequencerSettings } from '@/api/types';
import { SequencerEngine, type SequencerItem } from '@/features/sequencer/SequencerEngine';

interface SequencerState {
  engine: SequencerEngine;
  playing: boolean;
  index: number;
  activeTurnIds: string[];
  setItems: (items: SequencerItem[]) => void;
  applySettings: (settings: SequencerSettings) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
}

export const useSequencerStore = create<SequencerState>((set, get) => {
  const engine = new SequencerEngine();
  engine.subscribe((state) =>
    set({
      playing: state.playing,
      index: state.index,
      activeTurnIds: state.activeTurnIds,
    }),
  );
  return {
    engine,
    playing: false,
    index: 0,
    activeTurnIds: [],
    setItems: (items) => get().engine.setItems(items),
    applySettings: (settings) => get().engine.setSettings(settings),
    play: () => get().engine.play(),
    pause: () => get().engine.pause(),
    stop: () => get().engine.stop(),
  };
});
