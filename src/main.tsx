import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "sonner";

import { authClient } from "./lib/auth-client";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import App from "./App";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}
createRoot(rootElement).render(
  <StrictMode>
    <HelmetProvider>
      <ConvexProvider client={convex}>
        <ConvexBetterAuthProvider client={convex} authClient={authClient}>
          <ErrorBoundary>
            <App />
            <Toaster position="top-center" richColors />
          </ErrorBoundary>
        </ConvexBetterAuthProvider>
      </ConvexProvider>
    </HelmetProvider>
  </StrictMode>
);
