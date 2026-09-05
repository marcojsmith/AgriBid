// Clerk compatibility shim — replaces Better Auth client
// All components that import useSession from here continue to work unchanged.
import { useAuth, useUser } from "@clerk/clerk-react";

/**
 * Clerk compatibility shim replacing the Better Auth client's session hook.
 * Maps Clerk's useAuth/useUser state onto the legacy session shape
 * (`{ data: { user: { id, email, name } } | null, isPending }`) so existing
 * consumers continue to work unchanged.
 *
 * @returns The session object (`data` is null when signed out or Clerk has no
 * user) plus `isPending` while Clerk auth is still loading.
 */
export function useSession() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  const data =
    isSignedIn && user
      ? {
          user: {
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress ?? null,
            name: user.fullName ?? null,
          },
        }
      : null;

  return { data, isPending: !isLoaded };
}
