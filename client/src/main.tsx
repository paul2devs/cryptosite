import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import { PwaInstaller } from "./pwa/PwaInstaller";
import { store } from "./store";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <HelmetProvider>
      <BrowserRouter>
        <ErrorBoundary>
          <>
            <PwaInstaller />
            <App />
          </>
        </ErrorBoundary>
      </BrowserRouter>
      </HelmetProvider>
    </Provider>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && registration.waiting) {
              registration.waiting.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          // New SW has taken control; reload to get fresh assets
          window.location.reload();
        });
      })
      .catch(() => {});
  });
}

if (typeof window !== "undefined") {
  const hardReloadOnChunkError = () => {
    const key = "__chunk_reload_once__";
    if (sessionStorage.getItem(key) === "1") {
      return;
    }
    sessionStorage.setItem(key, "1");
    window.location.reload();
  };

  window.addEventListener("error", (event) => {
    const message =
      (event as ErrorEvent).message ||
      ((event as ErrorEvent).error && String((event as ErrorEvent).error)) ||
      "";
    if (message.includes("Failed to fetch dynamically imported module")) {
      hardReloadOnChunkError();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = String(event.reason || "");
    if (reason.includes("Failed to fetch dynamically imported module")) {
      hardReloadOnChunkError();
    }
  });
}