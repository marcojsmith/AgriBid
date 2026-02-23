/* eslint-disable react-refresh/only-export-components */
import { useContext } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

import { NO_PROVIDER, UserProfileContext } from "./user-profile-types";

/**
 * Provides the current user's profile to descendant components via a React context.
 *
 * @param children - React nodes to render inside the provider
 * @returns A React element that supplies the user profile context to its children
 */
export function UserProfileProvider({ children }: { children: ReactNode }) {
  const userProfile = useQuery(api.users.getMyProfile);

  return (
    <UserProfileContext.Provider value={userProfile}>
      {children}
    </UserProfileContext.Provider>
  );
}

/**
 * Retrieve the current user's profile from the UserProfile context.
 *
 * @returns The `UserProfile` value from context, `null` when the user has no profile, or `undefined` while the profile is loading.
 * @throws Error If called outside a `UserProfileProvider`.
 */
export function useUserProfile() {
  const context = useContext(UserProfileContext);
  // Throw if sentinel to ensure usage within provider
  if (context === NO_PROVIDER) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
}
