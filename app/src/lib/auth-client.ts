// app/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL || window.location.origin,
  plugins: [convexClient()],
});

export const { signIn, signUp, useSession, signOut } = authClient;
