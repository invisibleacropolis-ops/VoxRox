import type { Profile } from '@/api/types';
import { PixelPanel } from '@/ui/primitives/PixelPanel';
import { PixelScrollArea } from '@/ui/primitives/PixelScrollArea';
import { PixelTransport } from '@/ui/primitives/PixelTransport';
import { strip } from '@/lib/tagText';
import './profiles.css';

export interface ArchivePanelProps {
  profile: Profile;
}

export function ArchivePanel({ profile }: ArchivePanelProps) {
  const entries = [...profile.archive].reverse();
  return (
    <PixelPanel title="Generated audio archive" variant="sunken">
      <PixelScrollArea style={{ maxHeight: '180px' }}>
        {entries.length === 0 && <div className="vx-empty">nothing rendered yet</div>}
        {entries.map((entry) => (
          <div key={entry.id} className="vx-archive-row">
            <span data-testid="archive-text">
              <strong>{entry.projectName}</strong> — {strip(entry.text) || '(empty)'}
              <br />
              <span className="vx-card__meta">{entry.createdAt}</span>
            </span>
            <PixelTransport
              src={entry.url}
              name={`${entry.turnId}.wav`}
              durationSec={entry.durationSec}
              downloadable
            />
          </div>
        ))}
      </PixelScrollArea>
    </PixelPanel>
  );
}
