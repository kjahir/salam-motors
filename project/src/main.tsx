import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { PublicPassport } from './pages/PublicPassport.tsx';
import './index.css';

const passportMatch = window.location.pathname.match(/^\/passport\/([^/]+)\/?$/);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {passportMatch ? <PublicPassport slug={decodeURIComponent(passportMatch[1])} /> : <App />}
  </StrictMode>
);
