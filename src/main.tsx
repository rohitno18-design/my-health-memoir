import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

console.log("IM-SMRTI: Main loading...");

// Top-level crash protection for production
if (typeof window !== 'undefined') {
  console.log("IM-SMRTI: Registering global handlers");
  window.onerror = (message, source, lineno, colno, error) => {
    console.error("GLOBAL ERROR DETECTED:", message, error);
    const root = document.getElementById('root');
    if (root && root.innerHTML === '') {
      root.innerHTML = `<div style="padding: 40px; color: #e11d48; font-family: sans-serif; text-align: center; background: #fff1f2; min-height: 100vh;">
        <h1 style="font-weight: 900; font-size: 2rem;">Initialization Failed</h1>
        <p style="font-weight: 600; margin-top: 10px;">${message}</p>
        <div style="margin-top: 20px; font-size: 12px; opacity: 0.7; text-align: left; max-width: 400px; margin-left: auto; margin-right: auto; background: #fff; padding: 15px; border-radius: 8px;">
          <b>Trace:</b> ${source}:${lineno}:${colno}
        </div>
        <button onclick="window.location.reload()" style="margin-top: 30px; padding: 12px 24px; background: #0f172a; color: white; border-radius: 12px; border: none; font-weight: bold; cursor: pointer;">Reload Application</button>
      </div>`;
    }
  };

  window.onunhandledrejection = (event) => {
    console.error("UNHANDLED REJECTION DETECTED:", event.reason);
  };

  // Heartbeat: If DOM is still empty after 5s, something is fundamentally stuck
  setTimeout(() => {
    const root = document.getElementById('root');
    if (root && root.innerHTML === '') {
      console.warn("IM-SMRTI: Heartbeat detected empty DOM after 5s. Forcing recovery UI.");
      root.innerHTML = `<div style="padding: 40px; color: #0f172a; font-family: sans-serif; text-align: center;">
        <h1 style="font-weight: 900;">Application Stuck</h1>
        <p>The application is taking too long to start. This might be due to a slow connection or a service worker loop.</p>
        <button onclick="localStorage.clear(); sessionStorage.clear(); window.location.reload();" style="margin-top: 20px; padding: 10px 20px; background: #059669; color: white; border-radius: 12px; border: none; font-weight: bold;">Clear Cache & Reload</button>
      </div>`;
    }
  }, 5000);
}

import './i18n.ts'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

console.log("IM-SMRTI: Root mounting...");
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("IM-SMRTI: FATAL - Root element #root not found in DOM!");
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
  console.log("IM-SMRTI: Render call complete.");
}
