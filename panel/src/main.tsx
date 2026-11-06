import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from "virtual:pwa-register";

// Register service worker for PWA functionality
if (import.meta.env.PROD) {
  registerSW({
    onNeedRefresh() {
      console.log("New content available, please refresh.");
    },
    onOfflineReady() {
      console.log("App ready to work offline.");
    },
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
