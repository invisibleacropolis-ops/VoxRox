import { useEffect, useState } from 'react';
import type { GenerationParams } from '@/api/types';
import { ProfilePicker } from '@/features/chat/ProfilePicker';
import { RenderedTurn } from '@/features/chat/RenderedTurn';
import { TurnEditor } from '@/features/chat/TurnEditor';
import { ProfileCard } from '@/features/profiles/ProfileCard';
import { useProfileStore } from '@/state/profileStore';
import { useProjectStore } from '@/state/projectStore';
import { useSequencerStore } from '@/state/sequencerStore';
import { PixelButton } from '@/ui/primitives/PixelButton';
import { PixelFrame } from '@/ui/primitives/PixelFrame';
import { PixelPanel } from '@/ui/primitives/PixelPanel';
import { PixelScrollArea } from '@/ui/primitives/PixelScrollArea';
import '@/features/chat/chat.css';

export function ChatScreen() {
  const profiles = useProfileStore((state) => state.profiles);
  const byId = useProfileStore((state) => state.byId);
  const {
    current, summaries, error, renderingTurnId, editingTurnId, draftStatus,
    loadSummaries, open, close, create, addTurn, saveDraft, deleteTurn, renderTurn,
    setEditingTurn, restoreSession, clearError,
  } = useProjectStore();
  const activeTurnIds = useSequencerStore((state) => state.activeTurnIds);

  const [projectName, setProjectName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    void loadSummaries();
    // Reopen whatever session the browser was last in, so a reload lands back
    // in the transcript rather than on the project list.
    void restoreSession();
  }, [loadSummaries, restoreSession]);

  const editingTurn = current?.turns.find((turn) => turn.id === editingTurnId) ?? null;
  const editingProfile = editingTurn ? byId(editingTurn.profileId) : undefined;

  const pick = async (profileId: string) => {
    setPickerOpen(false);
    await addTurn(profileId);
  };

  if (!current) {
    return (
      <PixelFrame variant="dashed" style={{ height: '100%' }}>
        <PixelPanel title="Projects">
          <div className="vx-chips">
            <input
              className="vx-input"
              style={{ flex: 1 }}
              aria-label="New project name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
            />
            <PixelButton
              variant="primary"
              disabled={!projectName.trim()}
              onClick={() => {
                void create(projectName.trim());
                setProjectName('');
              }}
            >
              Create project
            </PixelButton>
          </div>
          <div style={{ marginTop: 'var(--gap-2)' }}>
            {summaries.length === 0 && <div className="vx-empty">no projects yet</div>}
            {summaries.map((summary) => (
              <PixelButton
                key={summary.id}
                className="vx-card"
                onClick={() => void open(summary.id)}
              >
                {summary.name} — {summary.renderedCount}/{summary.turnCount} rendered
              </PixelButton>
            ))}
          </div>
        </PixelPanel>
      </PixelFrame>
    );
  }

  return (
    <div className="vx-chat">
      <PixelFrame variant="dashed" className="vx-chat__rail">
        <PixelPanel title={current.name} variant="solid" className="vx-chat__cards">
          <PixelScrollArea style={{ flex: 1 }}>
            {current.participantIds.length === 0 && (
              <div className="vx-empty">no characters yet</div>
            )}
            <div className="vx-chat__cards">
              {current.participantIds.map((profileId) => {
                const profile = byId(profileId);
                if (!profile) return null;
                return <ProfileCard key={profileId} profile={profile} />;
              })}
            </div>
          </PixelScrollArea>
        </PixelPanel>
        <div className="vx-chips">
          <PixelButton
            className="vx-addbtn"
            variant="primary"
            size="lg"
            onClick={() => setPickerOpen(true)}
          >
            Add
          </PixelButton>
          <PixelButton size="sm" variant="ghost" onClick={close}>
            Sessions
          </PixelButton>
        </div>
      </PixelFrame>

      {/* The editor is docked inside this column, not a sibling of the grid —
          as a third grid item it landed in the narrow rail column. */}
      <PixelFrame
        variant="dashed"
        className="vx-chat__main"
        faceClassName="vx-chat__mainface"
      >
        <div className="vx-chat__log">
          {error && (
            <PixelFrame variant="accent">
              <span>{error}</span>
              <PixelButton size="sm" onClick={clearError}>
                Dismiss
              </PixelButton>
            </PixelFrame>
          )}
          {current.turns.length === 0 && (
            <div className="vx-empty">no turns yet — press Add to begin</div>
          )}
          {current.turns.map((turn) => (
            <RenderedTurn
              key={turn.id}
              turn={turn}
              profile={byId(turn.profileId)}
              active={activeTurnIds.includes(turn.id)}
              volume={current.sequencer.volume}
              onEdit={setEditingTurn}
              onDelete={(turnId) => void deleteTurn(turnId)}
            />
          ))}
        </div>

        {editingTurn && editingProfile && (
          <TurnEditor
            open
            className="vx-chat__editor"
            turn={editingTurn}
            profile={editingProfile}
            rendering={renderingTurnId === editingTurn.id}
            draftStatus={draftStatus}
            onSave={async (patch: { text: string; params: GenerationParams }) => {
              await saveDraft(editingTurn.id, patch);
            }}
            onRender={async () => {
              await renderTurn(editingTurn.id);
            }}
            onClose={() => setEditingTurn(null)}
          />
        )}
      </PixelFrame>

      <ProfilePicker
        open={pickerOpen}
        profiles={profiles}
        onPick={(profileId) => void pick(profileId)}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
