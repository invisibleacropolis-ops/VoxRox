import { useId, type MouseEvent } from 'react';
import './primitives.css';

export interface PixelWaveformProps {
  /** Normalised 0..1 peak magnitudes, one per bar. */
  peaks: number[];
  /** Playback position as a 0..1 fraction. */
  progress: number;
  onSeek?: (fraction: number) => void;
  accentColor?: string;
  className?: string;
  label?: string;
}

const VIEW_W = 320;
const VIEW_H = 64;
const MID = VIEW_H / 2;
const GAP = 0.35; // fraction of each slot left empty, gives the picket-fence look

export function PixelWaveform({
  peaks,
  progress,
  onSeek,
  accentColor,
  className = '',
  label = 'Waveform',
}: PixelWaveformProps) {
  const id = useId().replace(/:/g, '');
  const empty = peaks.length === 0;
  const clamped = Math.max(0, Math.min(1, progress));

  const slot = empty ? 0 : VIEW_W / peaks.length;
  const barWidth = Math.max(slot * (1 - GAP), 0.6);

  const seek = (event: MouseEvent<HTMLDivElement>) => {
    if (!onSeek || empty) return;
    const rect = event.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (event.clientX - rect.left) / (rect.width || 1))));
  };

  return (
    <div
      className={`vx-wave ${empty ? 'vx-wave--empty' : ''} ${className}`}
      role="presentation"
      aria-label={label}
      data-testid="waveform"
      onClick={seek}
    >
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none">
        <defs>
          {/* Unplayed: cold steel. Played: hot metal, brightest at the centre
              line so the bar reads as lit from within. */}
          <linearGradient id={`${id}-dim`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3d4457" />
            <stop offset="50%" stopColor="#6b7690" />
            <stop offset="100%" stopColor="#3d4457" />
          </linearGradient>
          <linearGradient id={`${id}-hot`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor ?? '#8a5f1d'} />
            <stop offset="35%" stopColor="#f0c96a" />
            <stop offset="50%" stopColor="#fff4cf" />
            <stop offset="65%" stopColor="#f0c96a" />
            <stop offset="100%" stopColor={accentColor ?? '#8a5f1d'} />
          </linearGradient>
          <clipPath id={`${id}-played`}>
            <rect x="0" y="0" width={VIEW_W * clamped} height={VIEW_H} />
          </clipPath>
        </defs>

        {!empty && (
          <>
            <g fill={`url(#${id}-dim)`}>
              {peaks.map((peak, index) => {
                const height = Math.max(peak * (VIEW_H - 4), 1.5);
                return (
                  <rect
                    key={index}
                    x={index * slot + (slot - barWidth) / 2}
                    y={MID - height / 2}
                    width={barWidth}
                    height={height}
                  />
                );
              })}
            </g>
            <g fill={`url(#${id}-hot)`} clipPath={`url(#${id}-played)`}>
              {peaks.map((peak, index) => {
                const height = Math.max(peak * (VIEW_H - 4), 1.5);
                return (
                  <rect
                    key={index}
                    x={index * slot + (slot - barWidth) / 2}
                    y={MID - height / 2}
                    width={barWidth}
                    height={height}
                  />
                );
              })}
            </g>
          </>
        )}

        {/* Centre rule — the zero line of the signal. */}
        <rect x="0" y={MID - 0.5} width={VIEW_W} height="1" fill="rgba(255,255,255,0.09)" />
      </svg>

      {!empty && (
        <div
          className="vx-wave__playhead"
          data-testid="playhead"
          style={{ left: `${clamped * 100}%` }}
        />
      )}
    </div>
  );
}
