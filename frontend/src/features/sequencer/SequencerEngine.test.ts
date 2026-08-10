import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SequencerEngine, type SequencerItem } from './SequencerEngine';

class FakeAudio {
  src = '';
  volume = 1;
  currentTime = 0;
  paused = true;
  playCount = 0;
  private handlers: Record<string, Array<() => void>> = {};

  play() {
    this.playCount += 1;
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  addEventListener(name: string, handler: () => void) {
    (this.handlers[name] ||= []).push(handler);
  }
  removeEventListener(name: string, handler: () => void) {
    this.handlers[name] = (this.handlers[name] || []).filter((h) => h !== handler);
  }
  end() {
    this.paused = true;
    for (const handler of this.handlers.ended || []) handler();
  }
}

const ITEMS: SequencerItem[] = [
  { turnId: 't1', url: '/media/1.wav', durationSec: 1 },
  { turnId: 't2', url: '/media/2.wav', durationSec: 1 },
  { turnId: 't3', url: '/media/3.wav', durationSec: 1 },
];

let created: FakeAudio[] = [];

function makeEngine() {
  created = [];
  return new SequencerEngine({
    createAudio: (src: string) => {
      const audio = new FakeAudio();
      audio.src = src;
      created.push(audio);
      return audio as unknown as HTMLAudioElement;
    },
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SequencerEngine', () => {
  it('plays the first item on play in sequential mode', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.play();
    expect(created).toHaveLength(1);
    expect(created[0].src).toBe('/media/1.wav');
    expect(created[0].playCount).toBe(1);
  });

  it('advances to the next item after the configured delay', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ delayMs: 500 });
    engine.play();
    created[0].end();
    expect(created).toHaveLength(1);
    vi.advanceTimersByTime(499);
    expect(created).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(created[1].src).toBe('/media/2.wav');
  });

  it('stops after the last item when loop is off', () => {
    const engine = makeEngine();
    const onState = vi.fn();
    engine.subscribe(onState);
    engine.setItems(ITEMS);
    engine.setSettings({ delayMs: 0 });
    engine.play();
    for (let index = 0; index < 3; index += 1) {
      created[index].end();
      vi.advanceTimersByTime(0);
    }
    expect(engine.getState().playing).toBe(false);
    expect(engine.getState().activeTurnIds).toEqual([]);
  });

  it('wraps to the first item when loop is on', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ delayMs: 0, loop: true });
    engine.play();
    for (let index = 0; index < 3; index += 1) {
      created[index].end();
      vi.advanceTimersByTime(0);
    }
    expect(created).toHaveLength(4);
    expect(created[3].src).toBe('/media/1.wav');
  });

  it('starts every item at once in simultaneous mode', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ mode: 'simultaneous', staggerMs: 0 });
    engine.play();
    expect(created).toHaveLength(3);
    expect(created.every((audio) => audio.playCount === 1)).toBe(true);
    expect(engine.getState().activeTurnIds).toEqual(['t1', 't2', 't3']);
  });

  it('staggers simultaneous starts', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ mode: 'simultaneous', staggerMs: 200 });
    engine.play();
    expect(created).toHaveLength(1);
    vi.advanceTimersByTime(200);
    expect(created).toHaveLength(2);
    vi.advanceTimersByTime(200);
    expect(created).toHaveLength(3);
  });

  it('applies volume to every element it creates', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ mode: 'simultaneous', staggerMs: 0, volume: 0.25 });
    engine.play();
    expect(created.map((audio) => audio.volume)).toEqual([0.25, 0.25, 0.25]);
  });

  it('stop halts playback, clears timers and resets the index', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ delayMs: 1000 });
    engine.play();
    created[0].end();
    engine.stop();
    vi.advanceTimersByTime(5000);
    expect(created).toHaveLength(1);
    expect(engine.getState().playing).toBe(false);
    expect(engine.getState().index).toBe(0);
  });

  it('pause keeps the index so play resumes the same item', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.setSettings({ delayMs: 0 });
    engine.play();
    created[0].end();
    vi.advanceTimersByTime(0);
    engine.pause();
    expect(engine.getState().playing).toBe(false);
    expect(engine.getState().index).toBe(1);
  });

  it('notifies subscribers of state changes', () => {
    const engine = makeEngine();
    const onState = vi.fn();
    engine.subscribe(onState);
    engine.setItems(ITEMS);
    engine.play();
    expect(onState).toHaveBeenCalled();
    expect(onState.mock.calls.at(-1)![0].activeTurnIds).toEqual(['t1']);
  });

  it('play with no items does nothing', () => {
    const engine = makeEngine();
    engine.setItems([]);
    engine.play();
    expect(created).toHaveLength(0);
    expect(engine.getState().playing).toBe(false);
  });

  it('playFrom starts at the given index', () => {
    const engine = makeEngine();
    engine.setItems(ITEMS);
    engine.playFrom(2);
    expect(created[0].src).toBe('/media/3.wav');
    expect(engine.getState().index).toBe(2);
  });
});
