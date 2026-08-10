import { useEffect, useState } from 'react';
import { SequencerBar } from '@/features/sequencer/SequencerBar';
import { ChatScreen } from '@/screens/ChatScreen';
import { ProfilesScreen } from '@/screens/ProfilesScreen';
import { ScriptScreen } from '@/screens/ScriptScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { useProfileStore } from '@/state/profileStore';
import { useVocabStore } from '@/state/vocabStore';
import { PixelTabs, type TabItem } from '@/ui/primitives/PixelTabs';

const TABS: TabItem[] = [
  { id: 'profiles', label: 'Profiles' },
  { id: 'chat', label: 'Chat' },
  { id: 'script', label: 'Script' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [screen, setScreen] = useState('profiles');
  const loadVocab = useVocabStore((state) => state.load);
  const loadProfiles = useProfileStore((state) => state.load);

  useEffect(() => {
    void loadVocab().catch(() => undefined);
    void loadProfiles();
  }, [loadVocab, loadProfiles]);

  return (
    <div className="vx-app vx-crt">
      <PixelTabs items={TABS} value={screen} onChange={setScreen} label="Main menu" />
      <SequencerBar />
      <main className="vx-screen">
        {screen === 'profiles' && <ProfilesScreen />}
        {screen === 'chat' && <ChatScreen />}
        {screen === 'script' && <ScriptScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </main>
    </div>
  );
}
