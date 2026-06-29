import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Base styles for the signer's built-in login UI; our styles.css overrides
// them for the dark theme (imported after, so our rules win).
import "@formstr/signer/styles.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
