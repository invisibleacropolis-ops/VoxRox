import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/api/client';
import type { Profile } from '@/api/types';
import { useProfileStore } from './profileStore';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p1',
    name: 'Ivy',
    createdAt: '2026-08-10T00:00:00+00:00',
    updatedAt: '2026-08-10T00:00:00+00:00',
    portraitUrl: null,
    card: { shortName: 'Ivy', tagline: '', accentColor: '#f2c14e' },
    voiceMode: 'auto',
    voice: {
      gender: '', age: '', pitch: '', style: '', accent: '',
      dialect: '', mood: '', intensity: 2, extra: [],
    },
    params: { numStep: 32, speed: 1, duration: null },
    samples: [],
    activeSampleId: null,
    narrative: { description: '', background: '' },
    customTags: [],
    archive: [],
    ...overrides,
  };
}

beforeEach(() => {
  useProfileStore.setState({
    profiles: [], selectedId: null, loading: false, error: null,
  });
  vi.restoreAllMocks();
});

describe('profileStore', () => {
  it('loads profiles and clears loading', async () => {
    vi.spyOn(api, 'listProfiles').mockResolvedValue([makeProfile()]);
    await useProfileStore.getState().load();
    expect(useProfileStore.getState().profiles).toHaveLength(1);
    expect(useProfileStore.getState().loading).toBe(false);
    expect(useProfileStore.getState().error).toBeNull();
  });

  it('records an error message when loading fails', async () => {
    vi.spyOn(api, 'listProfiles').mockRejectedValue(new Error('offline'));
    await useProfileStore.getState().load();
    expect(useProfileStore.getState().error).toBe('offline');
    expect(useProfileStore.getState().loading).toBe(false);
  });

  it('creates a profile, appends it and selects it', async () => {
    vi.spyOn(api, 'createProfile').mockResolvedValue(makeProfile({ id: 'p2', name: 'Rook' }));
    await useProfileStore.getState().create('Rook');
    const state = useProfileStore.getState();
    expect(state.profiles.map((p) => p.id)).toEqual(['p2']);
    expect(state.selectedId).toBe('p2');
  });

  it('replaces the stored profile after an update', async () => {
    useProfileStore.setState({ profiles: [makeProfile()] });
    vi.spyOn(api, 'updateProfile').mockResolvedValue(
      makeProfile({ voiceMode: 'design' }),
    );
    await useProfileStore.getState().update('p1', { voiceMode: 'design' });
    expect(useProfileStore.getState().profiles[0].voiceMode).toBe('design');
  });

  it('removes a deleted profile and clears the selection', async () => {
    useProfileStore.setState({ profiles: [makeProfile()], selectedId: 'p1' });
    vi.spyOn(api, 'deleteProfile').mockResolvedValue(undefined);
    await useProfileStore.getState().remove('p1');
    const state = useProfileStore.getState();
    expect(state.profiles).toEqual([]);
    expect(state.selectedId).toBeNull();
  });

  it('byId resolves a profile or undefined', () => {
    useProfileStore.setState({ profiles: [makeProfile()] });
    expect(useProfileStore.getState().byId('p1')?.name).toBe('Ivy');
    expect(useProfileStore.getState().byId('nope')).toBeUndefined();
  });

  it('applies a server profile returned by an upload', () => {
    useProfileStore.setState({ profiles: [makeProfile()] });
    useProfileStore.getState().applyProfile(makeProfile({ portraitUrl: '/media/x.png' }));
    expect(useProfileStore.getState().profiles[0].portraitUrl).toBe('/media/x.png');
  });
});
