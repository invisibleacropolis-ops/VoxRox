import { useState } from 'react';

const SCREENS = ['Profiles', 'Chat', 'Script', 'Settings'] as const;
export type ScreenName = (typeof SCREENS)[number];

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('Profiles');
  return (
    <div>
      <div role="tablist" aria-label="Main menu">
        {SCREENS.map((name) => (
          <button
            key={name}
            role="tab"
            aria-selected={screen === name}
            onClick={() => setScreen(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <main>{screen}</main>
    </div>
  );
}
