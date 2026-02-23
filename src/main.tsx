import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import UnderConstruction from '@/components/UnderConstruction';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UnderConstruction />
  </StrictMode>,
);
