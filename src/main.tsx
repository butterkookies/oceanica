import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WorldProvider } from 'koota/react';
import App from './App';
import { initializeAquariumWorld, oceanicaWorld } from './ecs/world';
import './index.css';

initializeAquariumWorld(oceanicaWorld);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorldProvider world={oceanicaWorld}>
      <App />
    </WorldProvider>
  </StrictMode>,
);
