import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { ServerSettings } from '@/api/types';
import { FONT_THEMES, useUiStore } from '@/state/uiStore';
import { useVocabStore } from '@/state/vocabStore';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelFrame } from '@/ui/primitives/PixelFrame';
import { PixelPanel } from '@/ui/primitives/PixelPanel';
import { PixelSlider } from '@/ui/primitives/PixelSlider';
import '@/features/profiles/profiles.css';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="vx-archive-row">
      <span>{label}</span>
      <span className="vx-path" title={value}>
        {value}
      </span>
    </div>
  );
}

export function SettingsScreen() {
  const { engine, refreshEngine, warmUp, tagGroups } = useVocabStore();
  const ui = useUiStore();
  const [server, setServer] = useState<ServerSettings | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    void refreshEngine().catch(() => undefined);
    void api
      .getServerSettings()
      .then(setServer)
      .catch((error: unknown) =>
        setServerError(error instanceof Error ? error.message : String(error)),
      );
  }, [refreshEngine]);

  const fps = ui.glintFrame > 0 ? 1 / ui.glintFrame : 0;

  return (
    <PixelFrame
      variant="dashed"
      className="vx-settings"
      faceClassName="vx-settings__body"
    >
      <PixelPanel title="Appearance" variant="solid">
        <div className="vx-field">
          <span className="vx-field__label">Interface font</span>
          <div className="vx-chips">
            {FONT_THEMES.map((theme) => (
              <PixelButton
                key={theme.id}
                size="sm"
                selected={ui.font === theme.id}
                title={theme.note}
                onClick={() => ui.set('font', theme.id)}
              >
                {theme.label}
              </PixelButton>
            ))}
          </div>
          <span className="vx-field__label">
            {FONT_THEMES.find((t) => t.id === ui.font)?.note}
          </span>
        </div>

        <PixelSlider
          label="Glint frame rate"
          min={0.02}
          max={2}
          step={0.02}
          value={ui.glintFrame}
          onChange={(value) => ui.set('glintFrame', Number(value.toFixed(2)))}
          format={() => `${fps.toFixed(1)} fps · ${(ui.glintFrame * 24).toFixed(1)}s sweep`}
        />
        <span className="vx-field__label">
          The sweep is 24 held frames; this sets seconds per frame.
        </span>

        <div className="vx-chips" style={{ marginTop: 'var(--gap-1)' }}>
          <PixelButton
            size="sm"
            selected={ui.glintEnabled}
            onClick={() => ui.set('glintEnabled', !ui.glintEnabled)}
          >
            Metal glint {ui.glintEnabled ? 'on' : 'off'}
          </PixelButton>
          <PixelButton
            size="sm"
            selected={ui.scanlines}
            onClick={() => ui.set('scanlines', !ui.scanlines)}
          >
            CRT scanlines {ui.scanlines ? 'on' : 'off'}
          </PixelButton>
          <PixelButton size="sm" variant="ghost" onClick={ui.reset}>
            Reset appearance
          </PixelButton>
        </div>
      </PixelPanel>

      <PixelPanel title="Engine" variant="solid">
        {engine ? (
          <div>
            <Row label="Model" value={engine.model} />
            <Row label="Device" value={engine.device} />
            <Row label="Precision" value={engine.dtype} />
            <div className="vx-archive-row">
              <span>Loaded</span>
              <span data-testid="engine-loaded">{engine.loaded ? 'yes' : 'no'}</span>
            </div>
            {engine.error && (
              <div className="vx-archive-row">
                <span>Last error</span>
                <span style={{ color: 'var(--c-bad)' }}>{engine.error}</span>
              </div>
            )}
            <div className="vx-chips" style={{ marginTop: 'var(--gap-1)' }}>
              <PixelButton onClick={() => void warmUp()}>Load model now</PixelButton>
              <PixelButton variant="ghost" onClick={() => void refreshEngine()}>
                Refresh
              </PixelButton>
            </div>
          </div>
        ) : (
          <div className="vx-empty">engine status unavailable</div>
        )}
      </PixelPanel>

      <PixelPanel title="File locations" variant="sunken">
        {serverError && <div className="vx-empty">server unreachable — {serverError}</div>}
        {server && (
          <div data-testid="paths">
            <Row label="Data root" value={server.paths.dataDir} />
            <Row label="Character profiles" value={server.paths.profiles} />
            <Row label="Chat sessions" value={server.paths.projects} />
            <Row label="Portraits" value={server.paths.portraits} />
            <Row label="Voice samples" value={server.paths.samples} />
            <Row label="Rendered audio" value={server.paths.renders} />
            <Row label="Preview scratch" value={server.paths.previewTmp} />
          </div>
        )}
      </PixelPanel>

      <PixelPanel title="Audio" variant="sunken">
        {server && (
          <div>
            <Row label="Sample rate" value={`${server.audio.sampleRate} Hz`} />
            <Row
              label="Channels"
              value={server.audio.channels === 1 ? 'mono' : `${server.audio.channels}`}
            />
            <Row
              label="Render format"
              value={`${server.audio.format} · ${server.audio.encoding}`}
            />
            <Row label="Waveform bars" value={`${server.audio.waveformBuckets}`} />
            <Row
              label="Diffusion steps"
              value={`${server.generation.numStepMin}–${server.generation.numStepMax} (default ${server.generation.numStepDefault})`}
            />
            <Row
              label="Speed range"
              value={`${server.generation.speedMin}x–${server.generation.speedMax}x`}
            />
            <Row
              label="Max fixed duration"
              value={`${server.generation.durationMaxSec}s`}
            />
          </div>
        )}
      </PixelPanel>

      <PixelPanel title="Environment overrides" variant="sunken">
        {server &&
          Object.entries(server.env).map(([key, value]) => (
            <Row key={key} label={key} value={value} />
          ))}
        <span className="vx-field__label">
          Set these before starting the backend to relocate data or change device.
        </span>
      </PixelPanel>

      <PixelPanel title="Tag vocabulary" variant="sunken">
        {tagGroups.map((group) => (
          <div key={group.id} className="vx-archive-row">
            <span>{group.label}</span>
            <span className="vx-path">
              {group.tags.map((tag) => tag.token).join(' ')}
            </span>
          </div>
        ))}
        <div className="vx-archive-row">
          <span>English pronunciation</span>
          <span className="vx-path">CMU arpabet in caps, e.g. [B EY1 S]</span>
        </div>
        <div className="vx-archive-row">
          <span>Chinese pronunciation</span>
          <span className="vx-path">Pinyin with tone numbers, e.g. ZHE2</span>
        </div>
      </PixelPanel>

      <PixelPanel title="Typefaces" variant="sunken">
        <span className="vx-field__label">
          Bundled locally under frontend/public/fonts — all SIL Open Font License
          1.1, with each licence file kept beside its font.
        </span>
        {FONT_THEMES.filter((theme) => theme.id !== 'system').map((theme) => (
          <div key={theme.id} className="vx-archive-row">
            <span>{theme.label}</span>
            <span className="vx-path">{theme.note}</span>
          </div>
        ))}
      </PixelPanel>
    </PixelFrame>
  );
}
