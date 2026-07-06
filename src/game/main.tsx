/// <reference types="vite/client" />
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import "./styles.css";

// PWA: register the service worker (production builds only — dev serves
// modules straight from memory and has no emitted sw.js).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js")
      .catch(() => {
        /* registration failure just means no offline support */
      });
  });
  // Ask the browser for durable storage. Safari evicts script-writable
  // storage (including the Cache API the SW fills) after ~7 days of disuse;
  // persisted storage — and installed PWAs — are exempt. Fire-and-forget:
  // a denial simply leaves the default eviction rules in place.
  navigator.storage?.persist?.().catch(() => {
    /* ignore */
  });
}

const root = document.getElementById("root");
if (!root) throw new Error("No #root element");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
