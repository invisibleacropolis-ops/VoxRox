import { useEffect, useRef, useState } from 'react';
import { formatTime } from '@/lib/formatTime';
import { PixelButton } from './PixelButton';
import { PixelWaveform } from './PixelWaveform';
import './primitives.css';

export interface PixelTransportProps {
  src: string | null;
  name: string;
  durationSec?: number;
  downloadable?: boolean;
  volume?: number;
  /** Normalised waveform peaks from the backend. */
  peaks?: number[];
  /** Tints the played portion of the waveform. */
  accentColor?: string;
  className?: string;
}

export function PixelTransport({
  src,
  name,
  durationSec = 0,
  downloadable = false,
  volume = 1,
  peaks = [],
  accentColor,
  className = '',
}: PixelTransportProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [total, setTotal] = useState(durationSec);

  useEffect(() => setTotal(durationSec), [durationSec]);
  useEffect(() => {
    setPlaying(false);
    setElapsed(0);
  }, [src]);
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume, src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play();
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setElapsed(0);
  };

  const seekTo = (fraction: number) => {
    const audio = audioRef.current;
    if (!audio || !total) return;
    audio.currentTime = fraction * total;
    setElapsed(audio.currentTime);
  };

  const progress = total > 0 ? elapsed / total : 0;

  return (
    <div className={`vx-transport ${src ? '' : 'vx-transport--empty'} ${className}`}>
      <span className="vx-transport__name">{name}</span>
      <PixelWaveform
        peaks={src ? peaks : []}
        progress={progress}
        onSeek={seekTo}
        accentColor={accentColor}
      />
      <span className="vx-transport__time">
        {formatTime(elapsed)} / {formatTime(total)}
      </span>
      <PixelButton size="sm" onClick={toggle} disabled={!src}>
        {playing ? 'Pause' : 'Play'}
      </PixelButton>
      <PixelButton size="sm" variant="ghost" onClick={stop} disabled={!src}>
        Stop
      </PixelButton>
      {downloadable && src && (
        <a
          className="vx-btn vx-btn--sm vx-btn--ghost"
          href={src}
          download={name}
          aria-label={`Download ${name}`}
        >
          <span className="vx-btn__face vx-glint">Save</span>
        </a>
      )}
      {src && (
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            setElapsed(0);
          }}
          onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => {
            const value = event.currentTarget.duration;
            if (Number.isFinite(value) && value > 0) setTotal(value);
          }}
        />
      )}
    </div>
  );
}
