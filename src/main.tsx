import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept window.fetch to support routing api calls to any remote backend endpoint
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url = typeof input === "string" 
    ? input 
    : input instanceof URL 
      ? input.toString() 
      : input.url;

  if (url.startsWith("/api/")) {
    const apiBase = ((import.meta as any).env?.VITE_API_BASE_URL || "").trim();
    if (apiBase) {
      const base = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
      url = `${base}${url}`;
    }
  }

  if (typeof input === "string") {
    return originalFetch(url, init);
  } else if (input instanceof URL) {
    return originalFetch(new URL(url), init);
  } else {
    const newRequest = new Request(url, input);
    return originalFetch(newRequest, init);
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

