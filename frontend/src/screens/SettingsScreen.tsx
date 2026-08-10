import { useEffect } from 'react';
import { useVocabStore } from '@/state/vocabStore';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelFrame } from '@/ui/primitives/PixelFrame';
import { PixelPanel } from '@/ui/primitives/PixelPanel';

export function SettingsScreen() {
  const { engine, refreshEngine, warmUp, tagGroups } = useVocabStore();

  useEffect(() => {
    void refreshEngine().catch(() => undefined);
  }, [refreshEngine]);

  return (
    <PixelFrame variant="dashed" style={{ height: '100%', overflowY: 'auto' }}>
      <PixelPanel title="Engine">
        {engine ? (
          <div>
            <div className="vx-archive-row">
              <span>Model</span>
              <span>{engine.model}</span>
            </div>
            <div className="vx-archive-row">
              <span>Device</span>
              <span>{engine.device}</span>
            </div>
            <div className="vx-archive-row">
              <span>Precision</span>
              <span>{engine.dtype}</span>
            </div>
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

      <PixelPanel title="Tag vocabulary" variant="sunken">
        {tagGroups.map((group) => (
          <div key={group.id} className="vx-archive-row">
            <span>{group.label}</span>
            <span>{group.tags.map((tag) => tag.token).join(' ')}</span>
          </div>
        ))}
      </PixelPanel>

      <PixelPanel title="Pronunciation control" variant="sunken">
        <div className="vx-archive-row">
          <span>English</span>
          <span>CMU arpabet in uppercase brackets, e.g. [B EY1 S]</span>
        </div>
        <div className="vx-archive-row">
          <span>Chinese</span>
          <span>Pinyin with tone numbers, e.g. ZHE2</span>
        </div>
      </PixelPanel>
    </PixelFrame>
  );
}
