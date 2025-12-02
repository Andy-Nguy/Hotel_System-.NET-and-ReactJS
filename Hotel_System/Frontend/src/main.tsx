import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Debug: log the Vite API URL at build/runtime (avoids placing void expression inside JSX)
// Use a safe cast to avoid TypeScript errors when the `ImportMeta.env` type is not picked up
console.log("VITE_API_URL =", (import.meta as any).env?.VITE_API_URL);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
