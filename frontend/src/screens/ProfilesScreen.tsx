import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import type { DeepPartial, Profile } from '@/api/types';
import { ArchivePanel } from '@/features/profiles/ArchivePanel';
import { ProfileCard } from '@/features/profiles/ProfileCard';
import { SamplesBar } from '@/features/profiles/SamplesBar';
import { VoiceSettingsPanel } from '@/features/profiles/VoiceSettingsPanel';
import { useProfileStore } from '@/state/profileStore';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelFrame } from '@/ui/primitives/PixelFrame';
import { PixelPanel } from '@/ui/primitives/PixelPanel';
import { PixelScrollArea } from '@/ui/primitives/PixelScrollArea';
import { PixelTextArea } from '@/ui/primitives/PixelTextArea';
import '@/features/profiles/profiles.css';

export function ProfilesScreen() {
  const { profiles, selectedId, select, create, update, remove, applyProfile, error } =
    useProfileStore();
  const [draftName, setDraftName] = useState('');
  const portraitRef = useRef<HTMLInputElement | null>(null);
  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [background, setBackground] = useState('');
  const [tagline, setTagline] = useState('');

  useEffect(() => {
    setName(selected?.name ?? '');
    setDescription(selected?.narrative.description ?? '');
    setBackground(selected?.narrative.background ?? '');
    setTagline(selected?.card.tagline ?? '');
  }, [selected?.id]);

  const patch = (body: DeepPartial<Profile>) => {
    if (selected) void update(selected.id, body);
  };

  const uploadPortrait = async (file: File) => {
    if (!selected) return;
    applyProfile(await api.uploadPortrait(selected.id, file));
  };

  const submitNew = () => {
    if (!draftName.trim()) return;
    void create(draftName.trim());
    setDraftName('');
  };

  return (
    <div className="vx-profiles">
      <PixelFrame variant="dashed" className="vx-profiles__rail">
        <PixelPanel title="Characters" variant="solid" className="vx-profiles__list">
          <PixelScrollArea style={{ flex: 1 }}>
            {profiles.length === 0 && (
              <div className="vx-empty">no profiles yet — create one below</div>
            )}
            <div className="vx-profiles__list">
              {profiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  onSelect={select}
                  selected={profile.id === selectedId}
                />
              ))}
            </div>
          </PixelScrollArea>
        </PixelPanel>
        <div className="vx-chips">
          <input
            className="vx-input"
            style={{ flex: 1 }}
            aria-label="New profile name"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitNew();
            }}
          />
          <PixelButton variant="primary" disabled={!draftName.trim()} onClick={submitNew}>
            New
          </PixelButton>
        </div>
        {error && <span className="vx-field__label">{error}</span>}
      </PixelFrame>

      {selected ? (
        <PixelFrame variant="dashed" className="vx-profiles__detail">
          <div className="vx-profiles__head">
            <PixelPanel title="Portrait" variant="solid">
              <div className="vx-portrait">
                {selected.portraitUrl ? (
                  <img
                    className="vx-portrait__img"
                    src={selected.portraitUrl}
                    alt={selected.name}
                  />
                ) : (
                  <div className="vx-portrait__img" />
                )}
                <input
                  ref={portraitRef}
                  type="file"
                  accept="image/*"
                  data-testid="portrait-input"
                  style={{ display: 'none' }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPortrait(file);
                  }}
                />
                <PixelButton size="sm" onClick={() => portraitRef.current?.click()}>
                  Upload picture
                </PixelButton>
                <div className="vx-field" style={{ width: '100%' }}>
                  <span className="vx-field__label">Name</span>
                  <input
                    className="vx-input"
                    aria-label="Character name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onBlur={() => name !== selected.name && patch({ name })}
                  />
                  <span className="vx-field__label">Card tagline</span>
                  <input
                    className="vx-input"
                    aria-label="Card tagline"
                    value={tagline}
                    onChange={(event) => setTagline(event.target.value)}
                    onBlur={() =>
                      tagline !== selected.card.tagline && patch({ card: { tagline } })
                    }
                  />
                </div>
                <PixelButton
                  size="sm"
                  variant="danger"
                  onClick={() => void remove(selected.id)}
                >
                  Delete profile
                </PixelButton>
              </div>
            </PixelPanel>
            <VoiceSettingsPanel profile={selected} onChange={patch} />
          </div>

          <PixelPanel title="Character description and narrative background" variant="solid">
            <SamplesBar profile={selected} />
            <div className="vx-field">
              <span className="vx-field__label">Description</span>
              <PixelTextArea
                aria-label="Character description"
                value={description}
                minRows={3}
                maxRows={10}
                onChange={setDescription}
                onBlur={() =>
                  description !== selected.narrative.description &&
                  patch({ narrative: { description } })
                }
              />
            </div>
            <div className="vx-field">
              <span className="vx-field__label">Background</span>
              <PixelTextArea
                aria-label="Character background"
                value={background}
                minRows={3}
                maxRows={10}
                onChange={setBackground}
                onBlur={() =>
                  background !== selected.narrative.background &&
                  patch({ narrative: { background } })
                }
              />
            </div>
          </PixelPanel>

          <ArchivePanel profile={selected} />
        </PixelFrame>
      ) : (
        <PixelFrame variant="dashed">
          <div className="vx-empty">select a character to edit</div>
        </PixelFrame>
      )}
    </div>
  );
}
