# VoxRox

Multi-voice TTS narration platform with a low-res pixel-RPG interface, built on
[k2-fsa/OmniVoice](https://github.com/k2-fsa/OmniVoice).

## Layout

- `backend/` — FastAPI service. Owns all state (JSON docs + media files) and the
  OmniVoice engine.
- `frontend/` — Vite + React + TypeScript UI.
- `data/` — runtime state (gitignored): profiles, projects, portraits, samples, renders.

## Setup

Backend (Python 3.11 — PyTorch has no 3.14 wheels):

```bash
py -3.11 -m venv backend/.venv
backend/.venv/Scripts/python -m pip install -e "backend[dev]"
backend/.venv/Scripts/python -m pip install torch==2.8.0+cu128 torchaudio==2.8.0+cu128 --extra-index-url https://download.pytorch.org/whl/cu128
backend/.venv/Scripts/python -m pip install omnivoice
```

Frontend:

```bash
npm install --prefix frontend
```

## Run

Two terminals:

```bash
pwsh ./run-backend.ps1
```

```bash
pwsh ./run-frontend.ps1
```

Then open http://localhost:5173.

## Test

```bash
backend/.venv/Scripts/python -m pytest backend/tests
```

```bash
npm test --prefix frontend
```

The real-model test is opt-in and needs CUDA plus the downloaded weights:

```bash
backend/.venv/Scripts/python -m pytest backend/tests -m gpu
```

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `VOXROX_DATA_DIR` | `<repo>/data` | Where profiles, projects and media live |
| `VOXROX_DEVICE` | `cuda:0` | Torch device map for the model |
| `VOXROX_DTYPE` | `float16` | Model precision |
| `VOXROX_MODEL` | `k2-fsa/OmniVoice` | Hugging Face model id |

On a 6 GB GPU, drop **Diffusion steps** to 16 in the turn editor if you hit
out-of-memory during generation. Engine load errors surface on the Settings screen.

## Appearance

The **Settings** screen carries everything adjustable: interface font, glint frame
rate, CRT scanlines, engine status and warm-up, plus the resolved on-disk paths for
sessions, samples and rendered audio, and the fixed audio contract. Appearance
preferences persist in `localStorage` under `voxrox.ui`; paths and audio come from
`GET /api/settings` so they always reflect the running server.

### Bundled typefaces

Four pixel faces ship in `frontend/public/fonts/`, served locally — the app never
calls out to a font CDN. All are SIL Open Font License 1.1, with each licence kept
beside its font as `OFL-<Family>.txt`.

| Face | Character |
|---|---|
| Press Start 2P | 8-bit arcade; the default |
| Silkscreen | 16-bit UI, compact in dense panels |
| VT323 | CRT terminal, tall, good for long text |
| DotGothic16 | Dot-matrix console, full CJK — renders the Chinese dialect names |

Each theme carries a scale multiplier, because the faces differ sharply in natural
size per em; a fixed pixel ladder looks wrong across them.

## Tags

The non-verbal tag vocabulary is defined once in `backend/voxrox/tags.py` and served at
`GET /api/tags`; the editor's hotkey panel is generated from it. Pronunciation control
uses CMU arpabet in uppercase brackets (`[B EY1 S]`) for English and pinyin with tone
numbers (`ZHE2`) for Chinese — these pass through untouched.
