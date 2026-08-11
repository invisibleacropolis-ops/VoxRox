import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import type { GenerationParams, PreviewResult, Profile, Turn } from '@/api/types';
import { insertAt } from '@/lib/tagText';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelPanel } from '@/ui/primitives/PixelPanel';
import { PixelSlider } from '@/ui/primitives/PixelSlider';
import { PixelTextArea } from '@/ui/primitives/PixelTextArea';
import { PixelTransport } from '@/ui/primitives/PixelTransport';
import { PixelWindow } from '@/ui/primitives/PixelWindow';
import { TagPanel } from './TagPanel';
import './chat.css';

export interface TurnEditorProps {
  open: boolean;
  turn: Turn;
  profile: Profile;
  rendering: boolean;
  onSave: (patch: { text: string; params: GenerationParams }) => Promise<void>;
  onRender: () => Promise<void>;
  onClose: () => void;
  className?: string;
  /** Shown in the title bar so autosave is visible rather than implied. */
  draftStatus?: 'idle' | 'saving' | 'saved';
}

/** Quiet period after the last keystroke before a draft is written. */
export const AUTOSAVE_MS = 700;

export function TurnEditor({
  open,
  turn,
  profile,
  rendering,
  onSave,
  onRender,
  onClose,
  className = '',
  draftStatus = 'idle',
}: TurnEditorProps) {
  const [text, setText] = useState(turn.text);
  const [params, setParams] = useState<GenerationParams>(turn.params);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setText(turn.text);
    setParams(turn.params);
    setPreview(null);
    setError(null);
  }, [turn.id]);

  // Autosave. Without this a draft lives only in React state, so closing the
  // window or reloading the page threw the text away.
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  // Compared by value: every save returns a freshly parsed turn, so a
  // reference check would report "dirty" forever and autosave in a loop.
  const dirty =
    text !== turn.text ||
    params.numStep !== turn.params.numStep ||
    params.speed !== turn.params.speed ||
    params.duration !== turn.params.duration;

  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      void saveRef.current({ text, params });
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [text, params, dirty]);

  // Flush on unmount so closing never drops the last few keystrokes.
  const latest = useRef({ text, params, dirty });
  latest.current = { text, params, dirty };
  useEffect(
    () => () => {
      if (latest.current.dirty) {
        void saveRef.current({
          text: latest.current.text,
          params: latest.current.params,
        });
      }
    },
    [],
  );

  const blank = text.trim().length === 0;

  const insertToken = (token: string) => {
    const area = areaRef.current;
    const caret = area ? area.selectionStart : text.length;
    const next = insertAt(text, caret, token);
    setText(next.text);
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(next.caret, next.caret);
    });
  };

  const runPreview = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(
        await api.createPreview({ profileId: profile.id, text: text.trim(), params }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    await onSave({ text, params });
  };

  const render = async () => {
    setError(null);
    await save();
    await onRender();
  };

  const label = profile.card.shortName || profile.name;

  return (
    <PixelWindow
      open={open}
      ariaLabel={`Editing turn — ${label}`}
      title={
        <>
          <span>Editing turn — {label}</span>
          <span className="vx-editor__status" data-testid="draft-status">
            {draftStatus === 'saving' ? 'saving…' : draftStatus === 'saved' ? 'saved' : ''}
          </span>
        </>
      }
      onClose={onClose}
      className={className}
      footer={
        <>
          {error && <span className="vx-field__label">{error}</span>}
          <PixelButton
            onClick={() => {
              void save().then(onClose);
            }}
          >
            Save &amp; close
          </PixelButton>
          <PixelButton
            variant="primary"
            disabled={blank}
            busy={rendering}
            onClick={() => void render()}
          >
            Render
          </PixelButton>
        </>
      }
    >
      <div className="vx-editor">
        <div className="vx-editor__main">
          <PixelTextArea
            ref={areaRef}
            aria-label="Turn text"
            placeholder="Type what this character says..."
            value={text}
            onChange={setText}
            minRows={5}
            maxRows={20}
          />

          <PixelSlider
            label="Speed"
            min={0.5}
            max={2}
            step={0.05}
            value={params.speed}
            onChange={(speed) => setParams({ ...params, speed })}
            format={(value) => `${value.toFixed(2)}x`}
          />
          <PixelSlider
            label="Diffusion steps"
            min={16}
            max={32}
            step={1}
            value={params.numStep}
            onChange={(numStep) => setParams({ ...params, numStep })}
          />
          <PixelSlider
            label="Fixed duration"
            min={0}
            max={60}
            step={0.5}
            value={params.duration ?? 0}
            onChange={(value) =>
              setParams({ ...params, duration: value === 0 ? null : value })
            }
            format={(value) => (value === 0 ? 'auto' : `${value.toFixed(1)}s`)}
          />

          <PixelPanel title="Audio preview" variant="sunken">
            <div className="vx-chips">
              <PixelTransport
                className="vx-editor__preview"
                src={preview?.url ?? null}
                name={preview ? 'preview.wav' : 'no preview yet'}
                durationSec={preview?.durationSec ?? 0}
                peaks={preview?.peaks ?? []}
                accentColor={profile.card.accentColor}
              />
              <PixelButton disabled={blank} busy={busy} onClick={() => void runPreview()}>
                Preview
              </PixelButton>
            </div>
          </PixelPanel>
        </div>

        <div className="vx-editor__side">
          <TagPanel onInsert={insertToken} disabled={!open} />
        </div>
      </div>
    </PixelWindow>
  );
}
