export type VoiceMode = 'auto' | 'clone' | 'design';
export type TurnStatus = 'draft' | 'rendered';
export type SequencerMode = 'sequential' | 'simultaneous';

export interface GenerationParams {
  numStep: number;
  speed: number;
  duration: number | null;
}

export interface VoiceDesign {
  gender: string;
  age: string;
  pitch: string;
  style: string;
  accent: string;
  dialect: string;
  mood: string;
  intensity: number;
  extra: string[];
}

export interface VoiceSample {
  id: string;
  filename: string;
  url: string;
  transcript: string;
  durationSec: number;
  addedAt: string;
}

export interface ProfileCard {
  shortName: string;
  tagline: string;
  accentColor: string;
}

export interface Narrative {
  description: string;
  background: string;
}

export interface ArchiveEntry {
  id: string;
  projectId: string;
  projectName: string;
  turnId: string;
  text: string;
  url: string;
  durationSec: number;
  createdAt: string;
}

export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  portraitUrl: string | null;
  card: ProfileCard;
  voiceMode: VoiceMode;
  voice: VoiceDesign;
  params: GenerationParams;
  samples: VoiceSample[];
  activeSampleId: string | null;
  narrative: Narrative;
  customTags: string[];
  archive: ArchiveEntry[];
}

export interface TurnAudio {
  url: string;
  filename: string;
  durationSec: number;
  sampleRate: number;
  /** Normalised 0..1 waveform peaks, one per display bar. */
  peaks: number[];
  renderedAt: string;
}

export interface Turn {
  id: string;
  profileId: string;
  text: string;
  params: GenerationParams;
  voiceOverride: VoiceDesign | null;
  status: TurnStatus;
  audio: TurnAudio | null;
  createdAt: string;
  updatedAt: string;
}

export interface SequencerSettings {
  mode: SequencerMode;
  delayMs: number;
  staggerMs: number;
  loop: boolean;
  volume: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  participantIds: string[];
  turns: Turn[];
  sequencer: SequencerSettings;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  turnCount: number;
  renderedCount: number;
  participantIds: string[];
}

export interface Tag {
  token: string;
  label: string;
  description: string;
  hotkey: string;
}

export interface TagGroup {
  id: string;
  label: string;
  tags: Tag[];
}

export interface VoiceVocab {
  genders: string[];
  ages: string[];
  pitches: string[];
  styles: string[];
  accents: string[];
  dialects: string[];
  moods: string[];
  intensities: string[];
}

export interface EngineStatus {
  model: string;
  device: string;
  dtype: string;
  loaded: boolean;
  error: string | null;
  capabilities: string[];
}

export interface ServerSettings {
  paths: {
    dataDir: string;
    profiles: string;
    projects: string;
    portraits: string;
    samples: string;
    renders: string;
    previewTmp: string;
  };
  audio: {
    sampleRate: number;
    channels: number;
    format: string;
    encoding: string;
    waveformBuckets: number;
  };
  generation: {
    numStepMin: number;
    numStepMax: number;
    numStepDefault: number;
    speedMin: number;
    speedMax: number;
    speedDefault: number;
    durationMaxSec: number;
  };
  env: Record<string, string>;
}

export interface PreviewResult {
  url: string;
  durationSec: number;
  peaks: number[];
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
