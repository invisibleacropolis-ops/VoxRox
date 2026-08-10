import { useEffect } from 'react';
import { useVocabStore } from '@/state/vocabStore';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelPanel } from '@/ui/primitives/PixelPanel';
import './chat.css';

export interface TagPanelProps {
  onInsert: (token: string) => void;
  disabled?: boolean;
}

export function TagPanel({ onInsert, disabled = false }: TagPanelProps) {
  const tagGroups = useVocabStore((state) => state.tagGroups);

  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const pressed = event.key.toUpperCase();
      for (const group of tagGroups) {
        for (const tag of group.tags) {
          if (tag.hotkey.toUpperCase() === pressed) {
            event.preventDefault();
            onInsert(tag.token);
            return;
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tagGroups, onInsert, disabled]);

  return (
    <PixelPanel title="Tags" variant="sunken">
      {tagGroups.map((group) => (
        <div key={group.id} className="vx-tagpanel__group">
          <div className="vx-tagpanel__label">{group.label}</div>
          <div className="vx-tagpanel__grid">
            {group.tags.map((tag) => (
              <PixelButton
                key={tag.token}
                size="sm"
                disabled={disabled}
                title={`${tag.description} (Alt+${tag.hotkey})`}
                onClick={() => onInsert(tag.token)}
              >
                {tag.label}
              </PixelButton>
            ))}
          </div>
        </div>
      ))}
    </PixelPanel>
  );
}
