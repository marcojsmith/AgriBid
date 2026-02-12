// app/src/lib/auth.ts
import { betterAuth } from "better-auth";

// On the client, Better Auth handles its own database communication via the component's adapter
// But for Better Auth config, we need to pass the adapter that knows how to talk to Convex

// Safely determine the base URL, avoiding window access during SSR
const getBaseURL = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  // Fallback for server-side rendering
  return (import.meta.env.VITE_CONVEX_SITE_URL as string) || "http://localhost:5173";
};

export const auth = betterAuth({
  appName: "AgriBid",
  baseURL: getBaseURL(),
  // The client side configuration should not need the full database adapter
  // as it talks to the server side Better Auth instance.
  // Actually, for client-side 'better-auth' instance, it is mostly for types.
  // The 'authClient' in auth-client.ts is what is used.
  emailAndPassword: {
    enabled: true,
  },
});
