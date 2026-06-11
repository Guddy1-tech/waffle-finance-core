import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// Belt-and-suspenders runtime guard against console leakage.
// Vite's `esbuild.drop` removes most console.* calls from our own source
// at build time, but third-party dependencies sometimes ship pre-bundled
// and call console.* at runtime. In production we silence them so a
// public visitor doesn't see internal state in devtools.
if (import.meta.env.PROD && typeof window !== 'undefined') {
  const noop = () => {};
  // Preserve `console.error` so genuine browser exceptions remain visible.
  for (const method of ['log', 'info', 'debug', 'trace'] as const) {
    try {
      (console as any)[method] = noop;
    } catch {
      /* read-only console in some sandboxes — ignore */
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
  </React.StrictMode>,
)
