import type {
  DeepPartial,
  EngineStatus,
  GenerationParams,
  PreviewResult,
  Profile,
  Project,
  ProjectSummary,
  SequencerSettings,
  ServerSettings,
  TagGroup,
  VoiceDesign,
  VoiceVocab,
} from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const method = init.method ?? 'GET';
  const options: Record<string, unknown> = { method };
  if (init.form) {
    options.body = init.form;
  } else if (init.body !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(init.body);
  }

  const response = await fetch(path, options as RequestInit);
  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    let detail = `request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.detail === 'string') detail = payload.detail;
      else if (payload) detail = JSON.stringify(payload.detail ?? payload);
    } catch {
      /* keep the default message */
    }
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

export const api = {
  // vocabulary + engine
  getTags: () => request<{ groups: TagGroup[] }>('/api/tags'),
  getVoiceVocab: () => request<VoiceVocab>('/api/voice-vocab'),
  getServerSettings: () => request<ServerSettings>('/api/settings'),
  getEngineStatus: () => request<EngineStatus>('/api/engine/status'),
  warmUpEngine: () => request<EngineStatus>('/api/engine/warmup', { method: 'POST' }),

  // profiles
  listProfiles: () => request<Profile[]>('/api/profiles'),
  getProfile: (id: string) => request<Profile>(`/api/profiles/${id}`),
  createProfile: (name: string) =>
    request<Profile>('/api/profiles', { method: 'POST', body: { name } }),
  updateProfile: (id: string, patch: DeepPartial<Profile>) =>
    request<Profile>(`/api/profiles/${id}`, { method: 'PATCH', body: patch }),
  deleteProfile: (id: string) =>
    request<void>(`/api/profiles/${id}`, { method: 'DELETE' }),
  getInstruct: (id: string) =>
    request<{ instruct: string }>(`/api/profiles/${id}/instruct`),

  uploadPortrait: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<Profile>(`/api/profiles/${id}/portrait`, { method: 'POST', form });
  },
  uploadSample: (id: string, file: File, transcript = '') => {
    const form = new FormData();
    form.append('file', file);
    form.append('transcript', transcript);
    return request<Profile>(`/api/profiles/${id}/samples`, { method: 'POST', form });
  },
  deleteSample: (id: string, sampleId: string) =>
    request<Profile>(`/api/profiles/${id}/samples/${sampleId}`, { method: 'DELETE' }),
  activateSample: (id: string, sampleId: string) =>
    request<Profile>(`/api/profiles/${id}/samples/${sampleId}/activate`, {
      method: 'POST',
    }),

  // projects
  listProjects: () => request<ProjectSummary[]>('/api/projects'),
  getProject: (id: string) => request<Project>(`/api/projects/${id}`),
  createProject: (name: string) =>
    request<Project>('/api/projects', { method: 'POST', body: { name } }),
  updateProject: (
    id: string,
    patch: { name?: string; sequencer?: Partial<SequencerSettings> },
  ) => request<Project>(`/api/projects/${id}`, { method: 'PATCH', body: patch }),
  deleteProject: (id: string) =>
    request<void>(`/api/projects/${id}`, { method: 'DELETE' }),

  // turns
  addTurn: (projectId: string, profileId: string, text = '') =>
    request<Project>(`/api/projects/${projectId}/turns`, {
      method: 'POST',
      body: { profileId, text },
    }),
  updateTurn: (
    projectId: string,
    turnId: string,
    patch: {
      text?: string;
      params?: Partial<GenerationParams>;
      voiceOverride?: VoiceDesign | null;
    },
  ) =>
    request<Project>(`/api/projects/${projectId}/turns/${turnId}`, {
      method: 'PATCH',
      body: patch,
    }),
  deleteTurn: (projectId: string, turnId: string) =>
    request<Project>(`/api/projects/${projectId}/turns/${turnId}`, {
      method: 'DELETE',
    }),
  reorderTurns: (projectId: string, turnIds: string[]) =>
    request<Project>(`/api/projects/${projectId}/reorder`, {
      method: 'POST',
      body: { turnIds },
    }),
  renderTurn: (projectId: string, turnId: string) =>
    request<Project>(`/api/projects/${projectId}/turns/${turnId}/render`, {
      method: 'POST',
    }),

  // synthesis
  createPreview: (body: {
    profileId: string;
    text: string;
    params?: GenerationParams;
    voiceOverride?: VoiceDesign | null;
  }) => request<PreviewResult>('/api/preview', { method: 'POST', body }),
};
