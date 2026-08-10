import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, applyPrefs, loadPrefs, useUiStore } from './uiStore';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-font');
  document.documentElement.removeAttribute('data-scanlines');
  document.documentElement.style.removeProperty('--glint-frame');
  useUiStore.setState({ ...DEFAULT_PREFS });
});

describe('uiStore', () => {
  it('defaults to the 8-bit arcade face', () => {
    expect(DEFAULT_PREFS.font).toBe('press-start');
  });

  it('applies preferences onto the document root', () => {
    applyPrefs({ font: 'vt323', glintFrame: 0.25, scanlines: false, glintEnabled: true });
    const root = document.documentElement;
    expect(root.getAttribute('data-font')).toBe('vt323');
    expect(root.getAttribute('data-scanlines')).toBe('off');
    expect(root.style.getPropertyValue('--glint-frame')).toBe('0.25s');
  });

  it('mutes the glint by zeroing its opacity variable', () => {
    applyPrefs({ ...DEFAULT_PREFS, glintEnabled: false });
    expect(document.documentElement.style.getPropertyValue('--glint-opacity')).toBe('0');
  });

  it('persists a change and applies it', () => {
    useUiStore.getState().set('font', 'silkscreen');
    expect(document.documentElement.getAttribute('data-font')).toBe('silkscreen');
    expect(JSON.parse(localStorage.getItem('voxrox.ui')!).font).toBe('silkscreen');
  });

  it('reloads persisted preferences', () => {
    localStorage.setItem('voxrox.ui', JSON.stringify({ font: 'dotgothic' }));
    expect(loadPrefs().font).toBe('dotgothic');
    // Missing keys fall back rather than becoming undefined.
    expect(loadPrefs().glintFrame).toBe(DEFAULT_PREFS.glintFrame);
  });

  it('falls back to defaults on corrupt storage', () => {
    localStorage.setItem('voxrox.ui', 'not json');
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });

  it('reset restores every default', () => {
    const ui = useUiStore.getState();
    ui.set('font', 'vt323');
    ui.set('scanlines', false);
    useUiStore.getState().reset();
    expect(useUiStore.getState().font).toBe('press-start');
    expect(useUiStore.getState().scanlines).toBe(true);
  });
});
