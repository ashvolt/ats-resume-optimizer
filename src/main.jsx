import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "../ats-resume-builder.jsx";

// Stub for Claude's window.sendPrompt — copies the prompt to clipboard instead
window.sendPrompt = (msg) => {
  navigator.clipboard.writeText(msg).then(() => {
    alert(
      "Google Docs push requires Claude chat.\n\n" +
      "The prompt has been copied to your clipboard.\n" +
      "Paste it into claude.ai to update your Google Doc."
    );
  }).catch(() => {
    console.log("[sendPrompt stub]\n", msg);
    alert("Prompt logged to console. Paste into Claude to update Google Docs.");
  });
};

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
