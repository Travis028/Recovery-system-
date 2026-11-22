import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/inter';
import App from '@/App';
import { ThemeProvider } from '@/theme/ThemeProvider';
import '@/index.css';

// Early capture of beforeinstallprompt for Progressive Web App install flow
window.__ldrsDeferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__ldrsDeferredPrompt = e;
  window.dispatchEvent(new CustomEvent('ldrs:prompt-ready'));
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

// Register service worker for Progressive Web App (PWA) installability
if ('serviceWorker' in navigator) {
  const register = () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  };
  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register);
  }
}
