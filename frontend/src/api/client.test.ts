import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from './client';

function mockFetch(body: unknown, init: { status?: number } = {}) {
  const status = init.status ?? 200;
  const spy = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('lists profiles with a GET', async () => {
    const spy = mockFetch([{ id: 'p1' }]);
    await expect(api.listProfiles()).resolves.toEqual([{ id: 'p1' }]);
    expect(spy.mock.calls[0][0]).toBe('/api/profiles');
    expect(spy.mock.calls[0][1].method).toBe('GET');
  });

  it('creates a profile with a JSON body', async () => {
    const spy = mockFetch({ id: 'p1', name: 'Ivy' });
    await api.createProfile('Ivy');
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/profiles');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ name: 'Ivy' });
  });

  it('patches a profile', async () => {
    const spy = mockFetch({ id: 'p1' });
    await api.updateProfile('p1', { voiceMode: 'design' });
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/profiles/p1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ voiceMode: 'design' });
  });

  it('throws ApiError carrying the server detail', async () => {
    mockFetch({ detail: 'unknown tags: [wobble]' }, { status: 422 });
    await expect(api.createPreview({ profileId: 'p1', text: 'x' })).rejects.toThrow(
      ApiError,
    );
    await expect(
      api.createPreview({ profileId: 'p1', text: 'x' }),
    ).rejects.toThrow('unknown tags: [wobble]');
  });

  it('sends uploads as multipart without a JSON content type', async () => {
    const spy = mockFetch({ id: 'p1' });
    const file = new File(['x'], 'ref.wav', { type: 'audio/wav' });
    await api.uploadSample('p1', file, 'line');
    const [url, init] = spy.mock.calls[0];
    expect(url).toBe('/api/profiles/p1/samples');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers?.['Content-Type']).toBeUndefined();
  });

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => null }),
    );
    await expect(api.deleteProfile('p1')).resolves.toBeUndefined();
  });

  it('renders a turn at the nested route', async () => {
    const spy = mockFetch({ id: 'proj1' });
    await api.renderTurn('proj1', 't1');
    expect(spy.mock.calls[0][0]).toBe('/api/projects/proj1/turns/t1/render');
    expect(spy.mock.calls[0][1].method).toBe('POST');
  });
});
