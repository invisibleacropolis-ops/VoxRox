import { create } from 'zustand';

export const FONT_THEMES = [
  {
    id: 'press-start',
    label: 'Press Start 2P',
    note: '8-bit arcade — chunky, wide, all-caps friendly',
  },
  {
    id: 'silkscreen',
    label: 'Silkscreen',
    note: '16-bit UI — compact, dense panels stay readable',
  },
  { id: 'vt323', label: 'VT323', note: 'CRT terminal — tall, best for long text' },
  { id: 'dotgothic', label: 'DotGothic16', note: 'Dot-matrix console, full CJK coverage' },
  { id: 'system', label: 'System mono', note: 'Non-pixel fallback' },
] as const;

export type FontThemeId = (typeof FONT_THEMES)[number]['id'];

export interface UiPrefs {
  font: FontThemeId;
  /** Seconds per glint frame; the sweep is 24 frames long. */
  glintFrame: number;
  scanlines: boolean;
  glintEnabled: boolean;
}

export const DEFAULT_PREFS: UiPrefs = {
  font: 'press-start',
  glintFrame: 0.5,
  scanlines: true,
  glintEnabled: true,
};

const STORAGE_KEY = 'voxrox.ui';

export function loadPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** Push preferences onto <html> so CSS can read them. */
export function applyPrefs(prefs: UiPrefs): void {
  const root = document.documentElement;
  root.setAttribute('data-font', prefs.font);
  root.setAttribute('data-scanlines', prefs.scanlines ? 'on' : 'off');
  root.style.setProperty('--glint-frame', `${prefs.glintFrame}s`);
  // Zero-length frames collapse the sweep, which is how the effect is
  // switched off without stripping the rules from every component.
  root.style.setProperty('--glint-opacity', prefs.glintEnabled ? '1' : '0');
}

interface UiState extends UiPrefs {
  set: <K extends keyof UiPrefs>(key: K, value: UiPrefs[K]) => void;
  reset: () => void;
}

function persist(prefs: UiPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / quota — preferences simply do not survive the session */
  }
  applyPrefs(prefs);
}

export const useUiStore = create<UiState>((set, get) => ({
  ...loadPrefs(),
  set: (key, value) => {
    set((state) => ({ ...state, [key]: value }));
    const { font, glintFrame, scanlines, glintEnabled } = get();
    persist({ font, glintFrame, scanlines, glintEnabled });
  },
  reset: () => {
    set({ ...DEFAULT_PREFS });
    persist({ ...DEFAULT_PREFS });
  },
}));
