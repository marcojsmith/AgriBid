import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { authClient } from "./lib/auth-client";
import { Toaster } from "sonner";
import "./index.css";
import App from "./App.tsx";
import activityTracker from "./lib/activity-tracker";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

// Initialize the activity tracker early in the app lifecycle
try {
  activityTracker.initRouterIntegration();
} catch (e) {
  // non-fatal
  console.warn("Activity tracker init failed:", e);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <ConvexBetterAuthProvider client={convex} authClient={authClient}>
        <App />
        <Toaster position="top-center" richColors />
      </ConvexBetterAuthProvider>
    </ConvexProvider>
  </StrictMode>,
);
