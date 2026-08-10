import type React from 'react';
import type { Profile, Turn } from '@/api/types';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelFrame } from '@/ui/primitives/PixelFrame';
import { PixelTransport } from '@/ui/primitives/PixelTransport';
import './chat.css';

const TAG_PATTERN = /(\[[a-z0-9]+(?:-[a-z0-9]+)*\])/g;

function highlight(text: string) {
  return text.split(TAG_PATTERN).map((part, index) => {
    // TAG_PATTERN is global, so lastIndex must be reset before each .test().
    TAG_PATTERN.lastIndex = 0;
    return TAG_PATTERN.test(part) ? (
      <span key={index} className="vx-turn__tag">
        {part}
      </span>
    ) : (
      <span key={index}>{part}</span>
    );
  });
}

export interface RenderedTurnProps {
  turn: Turn;
  profile?: Profile;
  active?: boolean;
  volume?: number;
  onEdit?: (turnId: string) => void;
  onDelete?: (turnId: string) => void;
}

export function RenderedTurn({
  turn,
  profile,
  active = false,
  volume = 1,
  onEdit,
  onDelete,
}: RenderedTurnProps) {
  const label = profile ? profile.card.shortName || profile.name : 'unknown speaker';
  const accent = profile?.card.accentColor || '#837fa4';

  return (
    <PixelFrame
      variant="raised"
      studded
      className="vx-turn vx-anim-fly-left"
      style={{ '--accent': accent } as React.CSSProperties}
      data-testid="turn"
      data-active={active ? 'true' : 'false'}
    >
      <div className="vx-turn__head">
        <span className="vx-turn__speaker">{label}</span>
        <span>
          {turn.audio ? `${turn.audio.durationSec.toFixed(2)}s` : 'not rendered'}
          {onEdit && (
            <PixelButton size="sm" variant="ghost" onClick={() => onEdit(turn.id)}>
              Edit
            </PixelButton>
          )}
          {onDelete && (
            <PixelButton size="sm" variant="danger" onClick={() => onDelete(turn.id)}>
              Delete
            </PixelButton>
          )}
        </span>
      </div>

      <div className="vx-turn__text" data-testid="turn-text">
        {highlight(turn.text)}
      </div>

      <PixelTransport
        src={turn.audio?.url ?? null}
        name={turn.audio?.filename ?? 'no audio yet'}
        durationSec={turn.audio?.durationSec ?? 0}
        peaks={turn.audio?.peaks ?? []}
        accentColor={accent}
        volume={volume}
        downloadable={Boolean(turn.audio)}
      />
    </PixelFrame>
  );
}
