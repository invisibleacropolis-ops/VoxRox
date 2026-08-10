import { useEffect, useMemo } from 'react';
import type { SequencerMode } from '@/api/types';
import { useProjectStore } from '@/state/projectStore';
import { useSequencerStore } from '@/state/sequencerStore';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelSlider } from '@/ui/primitives/PixelSlider';
import type { SequencerItem } from './SequencerEngine';
import './sequencer.css';

const MODES: SequencerMode[] = ['sequential', 'simultaneous'];

export function SequencerBar() {
  const current = useProjectStore((state) => state.current);
  const setSequencer = useProjectStore((state) => state.setSequencer);
  const { engine, playing, index, activeTurnIds } = useSequencerStore();

  const items = useMemo<SequencerItem[]>(
    () =>
      (current?.turns ?? [])
        .filter((turn) => turn.audio !== null)
        .map((turn) => ({
          turnId: turn.id,
          url: turn.audio!.url,
          durationSec: turn.audio!.durationSec,
        })),
    [current?.turns],
  );

  useEffect(() => {
    engine.setItems(items);
  }, [engine, items]);

  const settings = current?.sequencer;
  useEffect(() => {
    if (settings) engine.setSettings(settings);
  }, [engine, settings]);

  useEffect(() => () => engine.stop(), [engine]);

  const disabled = !current || items.length === 0;

  return (
    <div
      className="vx-seqbar"
      data-testid="sequencer-bar"
      data-disabled={current ? 'false' : 'true'}
    >
      <span className="vx-seqbar__title">Chat Sequencer</span>

      <div className="vx-seqbar__group">
        <PixelButton
          disabled={disabled}
          onClick={() => (playing ? engine.pause() : engine.play())}
        >
          {playing ? 'Pause' : 'Play'}
        </PixelButton>
        <PixelButton variant="ghost" disabled={disabled} onClick={() => engine.stop()}>
          Stop
        </PixelButton>
      </div>

      <div className="vx-seqbar__group">
        {MODES.map((mode) => (
          <PixelButton
            key={mode}
            size="sm"
            selected={settings?.mode === mode}
            disabled={!current}
            onClick={() => void setSequencer({ mode })}
          >
            {mode}
          </PixelButton>
        ))}
        <PixelButton
          size="sm"
          selected={settings?.loop === true}
          disabled={!current}
          onClick={() => void setSequencer({ loop: !settings?.loop })}
        >
          Loop
        </PixelButton>
      </div>

      <PixelSlider
        className="vx-seqbar__slider"
        label="Gap"
        min={0}
        max={5000}
        step={50}
        value={settings?.delayMs ?? 0}
        disabled={!current}
        onChange={(delayMs) => void setSequencer({ delayMs })}
        format={(value) => `${value}ms`}
      />
      <PixelSlider
        className="vx-seqbar__slider"
        label="Stagger"
        min={0}
        max={5000}
        step={50}
        value={settings?.staggerMs ?? 0}
        disabled={!current}
        onChange={(staggerMs) => void setSequencer({ staggerMs })}
        format={(value) => `${value}ms`}
      />
      <PixelSlider
        className="vx-seqbar__slider"
        label="Volume"
        min={0}
        max={1}
        step={0.05}
        value={settings?.volume ?? 1}
        disabled={!current}
        onChange={(volume) => void setSequencer({ volume })}
        format={(value) => `${Math.round(value * 100)}%`}
      />

      <span className="vx-seqbar__status">
        {items.length} clip{items.length === 1 ? '' : 's'} queued
        {playing && ` — playing ${index + 1}/${items.length}`}
        {activeTurnIds.length > 1 && ` (${activeTurnIds.length} at once)`}
      </span>
    </div>
  );
}
