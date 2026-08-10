import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyPrefs, loadPrefs } from './state/uiStore';
import './styles/tokens.css';
import './styles/fonts.css';
import './styles/global.css';
import './ui/anim/animations.css';

// Applied before first paint so the chosen face is active immediately
// rather than flashing the default stack.
applyPrefs(loadPrefs());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
