import { useRef, useState } from 'react';
import { api } from '@/api/client';
import type { Profile } from '@/api/types';
import { useProfileStore } from '@/state/profileStore';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelTransport } from '@/ui/primitives/PixelTransport';
import './profiles.css';

export interface SamplesBarProps {
  profile: Profile;
}

export function SamplesBar({ profile }: SamplesBarProps) {
  const applyProfile = useProfileStore((state) => state.applyProfile);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      applyProfile(await api.uploadSample(profile.id, file, transcript));
      setTranscript('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (sampleId: string) => {
    applyProfile(await api.deleteSample(profile.id, sampleId));
  };

  const activate = async (sampleId: string) => {
    applyProfile(await api.activateSample(profile.id, sampleId));
  };

  return (
    <div className="vx-field">
      <span className="vx-field__label">Audio samples for cloning</span>
      <div className="vx-chips">
        <input
          className="vx-input"
          style={{ flex: 1 }}
          aria-label="Sample transcript"
          placeholder="Transcript (optional)"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          data-testid="sample-input"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <PixelButton size="sm" busy={busy} onClick={() => fileRef.current?.click()}>
          Upload sample
        </PixelButton>
      </div>
      {error && <span className="vx-field__label">{error}</span>}

      <div className="vx-samples">
        {profile.samples.length === 0 && (
          <span className="vx-empty">no samples yet</span>
        )}
        {profile.samples.map((sample) => (
          <div
            key={sample.id}
            className="vx-sample"
            data-active={profile.activeSampleId === sample.id ? 'true' : 'false'}
          >
            <PixelButton
              size="sm"
              variant="ghost"
              selected={profile.activeSampleId === sample.id}
              aria-label={`Use ${sample.filename} for cloning`}
              onClick={() => void activate(sample.id)}
            >
              Use
            </PixelButton>
            <span>{sample.filename}</span>
            <PixelTransport
              src={sample.url}
              name={sample.transcript || sample.filename}
              durationSec={sample.durationSec}
            />
            <PixelButton
              size="sm"
              variant="danger"
              aria-label={`Delete ${sample.filename}`}
              onClick={() => void remove(sample.id)}
            >
              Del
            </PixelButton>
          </div>
        ))}
      </div>
    </div>
  );
}
