import type { SequencerMode } from '@/api/types';

export interface SequencerItem {
  turnId: string;
  url: string;
  durationSec: number;
}

export interface SequencerSettingsInput {
  mode?: SequencerMode;
  delayMs?: number;
  staggerMs?: number;
  loop?: boolean;
  volume?: number;
}

export interface SequencerState {
  playing: boolean;
  index: number;
  activeTurnIds: string[];
}

interface Options {
  createAudio?: (src: string) => HTMLAudioElement;
}

const DEFAULTS = {
  mode: 'sequential' as SequencerMode,
  delayMs: 300,
  staggerMs: 0,
  loop: false,
  volume: 1,
};

export class SequencerEngine {
  private items: SequencerItem[] = [];
  private settings = { ...DEFAULTS };
  private state: SequencerState = { playing: false, index: 0, activeTurnIds: [] };
  private active: Array<{ turnId: string; audio: HTMLAudioElement; onEnded: () => void }> = [];
  private timers: ReturnType<typeof setTimeout>[] = [];
  private listeners = new Set<(state: SequencerState) => void>();
  private createAudio: (src: string) => HTMLAudioElement;

  constructor(options: Options = {}) {
    this.createAudio = options.createAudio ?? ((src: string) => new Audio(src));
  }

  subscribe(listener: (state: SequencerState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): SequencerState {
    return this.state;
  }

  setItems(items: SequencerItem[]): void {
    this.items = items;
    if (this.state.index >= items.length) this.patch({ index: 0 });
  }

  setSettings(patch: SequencerSettingsInput): void {
    this.settings = { ...this.settings, ...patch };
    for (const entry of this.active) entry.audio.volume = this.settings.volume;
  }

  play(): void {
    this.playFrom(this.state.index);
  }

  playFrom(index: number): void {
    if (this.items.length === 0) return;
    this.teardown();
    const start = Math.max(0, Math.min(index, this.items.length - 1));
    this.patch({ playing: true, index: start });
    if (this.settings.mode === 'simultaneous') this.startAll();
    else this.startAt(start);
  }

  pause(): void {
    for (const entry of this.active) entry.audio.pause();
    this.teardown();
    this.patch({ playing: false, activeTurnIds: [] });
  }

  stop(): void {
    for (const entry of this.active) {
      entry.audio.pause();
      entry.audio.currentTime = 0;
    }
    this.teardown();
    this.patch({ playing: false, index: 0, activeTurnIds: [] });
  }

  dispose(): void {
    this.stop();
    this.listeners.clear();
  }

  // --- internals -----------------------------------------------------

  private patch(partial: Partial<SequencerState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener(this.state);
  }

  private teardown(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
    for (const entry of this.active) {
      entry.audio.removeEventListener('ended', entry.onEnded);
    }
    this.active = [];
  }

  private spawn(item: SequencerItem, onEnded: () => void): void {
    const audio = this.createAudio(item.url);
    audio.volume = this.settings.volume;
    audio.addEventListener('ended', onEnded);
    this.active.push({ turnId: item.turnId, audio, onEnded });
    void audio.play();
  }

  private startAt(index: number): void {
    const item = this.items[index];
    if (!item) {
      this.patch({ playing: false, index: 0, activeTurnIds: [] });
      return;
    }
    this.spawn(item, () => this.advanceFrom(index));
    this.patch({ index, activeTurnIds: [item.turnId] });
  }

  private advanceFrom(index: number): void {
    const next = index + 1;
    const wrapped = next >= this.items.length;
    if (wrapped && !this.settings.loop) {
      this.teardown();
      this.patch({ playing: false, index: 0, activeTurnIds: [] });
      return;
    }
    const target = wrapped ? 0 : next;
    this.patch({ index: target });
    const timer = setTimeout(() => {
      this.teardown();
      if (!this.state.playing) return;
      this.startAt(target);
    }, this.settings.delayMs);
    this.timers.push(timer);
  }

  private startAll(): void {
    const finished = new Set<string>();
    const complete = (turnId: string) => {
      finished.add(turnId);
      if (finished.size < this.items.length) return;
      this.teardown();
      if (this.settings.loop) this.startAll();
      else this.patch({ playing: false, index: 0, activeTurnIds: [] });
    };

    this.items.forEach((item, position) => {
      const launch = () => {
        this.spawn(item, () => complete(item.turnId));
        this.patch({
          activeTurnIds: [...this.state.activeTurnIds, item.turnId],
        });
      };
      if (position === 0 || this.settings.staggerMs === 0) launch();
      else {
        this.timers.push(setTimeout(launch, this.settings.staggerMs * position));
      }
    });
    this.patch({ activeTurnIds: this.active.map((entry) => entry.turnId) });
  }
}
