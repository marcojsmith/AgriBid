import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";

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
      <ClerkProvider
        publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      >
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ErrorBoundary>
            <App />
            <Toaster position="top-center" richColors />
            <Analytics />
          </ErrorBoundary>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </HelmetProvider>
  </StrictMode>
);
