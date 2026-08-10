import { useState } from 'react';
import type { DeepPartial, Profile, VoiceMode } from '@/api/types';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelPanel } from '@/ui/primitives/PixelPanel';
import { PixelSlider } from '@/ui/primitives/PixelSlider';
import { PixelStepSlider } from '@/ui/primitives/PixelStepSlider';
import { useVocabStore } from '@/state/vocabStore';
import './profiles.css';

const MODES: VoiceMode[] = ['auto', 'clone', 'design'];

export interface VoiceSettingsPanelProps {
  profile: Profile;
  onChange: (patch: DeepPartial<Profile>) => void;
}

export function VoiceSettingsPanel({ profile, onChange }: VoiceSettingsPanelProps) {
  const vocab = useVocabStore((state) => state.vocab);
  const [tagDraft, setTagDraft] = useState('');

  const indexOf = (list: string[], value: string) => {
    const found = list.indexOf(value);
    return found < 0 ? 0 : found;
  };
  const pick = (list: string[], index: number) => list[index] ?? '';

  const addTag = () => {
    const token = tagDraft.trim();
    if (!token || profile.customTags.includes(token)) return;
    onChange({ customTags: [...profile.customTags, token] } as DeepPartial<Profile>);
    setTagDraft('');
  };

  return (
    <PixelPanel title="Profile Settings" variant="solid">
      <div className="vx-field">
        <span className="vx-field__label">Voice mode</span>
        <div className="vx-chips">
          {MODES.map((mode) => (
            <PixelButton
              key={mode}
              size="sm"
              selected={profile.voiceMode === mode}
              onClick={() => onChange({ voiceMode: mode })}
            >
              {mode}
            </PixelButton>
          ))}
        </div>
      </div>

      <PixelStepSlider
        label="Gender"
        options={vocab.genders}
        index={indexOf(vocab.genders, profile.voice.gender)}
        onChange={(index) => onChange({ voice: { gender: pick(vocab.genders, index) } })}
      />
      <PixelStepSlider
        label="Age"
        options={vocab.ages}
        index={indexOf(vocab.ages, profile.voice.age)}
        onChange={(index) => onChange({ voice: { age: pick(vocab.ages, index) } })}
      />
      <PixelStepSlider
        label="Pitch"
        options={vocab.pitches}
        index={indexOf(vocab.pitches, profile.voice.pitch)}
        onChange={(index) => onChange({ voice: { pitch: pick(vocab.pitches, index) } })}
      />
      <PixelStepSlider
        label="Emotion"
        options={vocab.moods}
        index={indexOf(vocab.moods, profile.voice.mood)}
        onChange={(index) => onChange({ voice: { mood: pick(vocab.moods, index) } })}
      />
      <PixelStepSlider
        label="Intensity"
        options={vocab.intensities.map((word) => word || 'plain')}
        index={profile.voice.intensity}
        onChange={(index) => onChange({ voice: { intensity: index } })}
      />
      <PixelStepSlider
        label="Accent"
        options={vocab.accents}
        index={indexOf(vocab.accents, profile.voice.accent)}
        onChange={(index) => onChange({ voice: { accent: pick(vocab.accents, index) } })}
      />
      <PixelStepSlider
        label="Dialect"
        options={vocab.dialects}
        index={indexOf(vocab.dialects, profile.voice.dialect)}
        onChange={(index) => onChange({ voice: { dialect: pick(vocab.dialects, index) } })}
      />
      <PixelStepSlider
        label="Style"
        options={vocab.styles}
        index={indexOf(vocab.styles, profile.voice.style)}
        onChange={(index) => onChange({ voice: { style: pick(vocab.styles, index) } })}
      />

      <PixelSlider
        label="Speed"
        min={0.5}
        max={2}
        step={0.05}
        value={profile.params.speed}
        onChange={(speed) => onChange({ params: { speed } })}
        format={(value) => `${value.toFixed(2)}x`}
      />
      <PixelSlider
        label="Diffusion steps"
        min={16}
        max={32}
        step={1}
        value={profile.params.numStep}
        onChange={(numStep) => onChange({ params: { numStep } })}
      />

      <div className="vx-field">
        <span className="vx-field__label">Custom tags</span>
        <div className="vx-chips">
          {profile.customTags.map((tag) => (
            <span key={tag} className="vx-chip">
              {tag}
              <PixelButton
                size="sm"
                variant="ghost"
                aria-label={`Remove tag ${tag}`}
                onClick={() =>
                  onChange({
                    customTags: profile.customTags.filter((t) => t !== tag),
                  } as DeepPartial<Profile>)
                }
              >
                x
              </PixelButton>
            </span>
          ))}
        </div>
        <div className="vx-chips">
          <input
            className="vx-input"
            style={{ flex: 1 }}
            aria-label="New tag"
            value={tagDraft}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addTag();
              }
            }}
          />
          <PixelButton size="sm" onClick={addTag}>
            Add tag
          </PixelButton>
        </div>
      </div>
    </PixelPanel>
  );
}
