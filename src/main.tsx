import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import LandingPage from './LandingPage';
import './index.css';

function Root() {
  const [showGame, setShowGame] = useState(false);

  if (showGame) return <App />;
  return <LandingPage onPlayNow={() => setShowGame(true)} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
