import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Keeps the theme applied, including when the system setting changes.
import "./lib/theme";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
