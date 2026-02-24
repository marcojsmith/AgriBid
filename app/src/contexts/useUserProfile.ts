 
import { useContext } from "react";
import { UserProfileContext, NO_PROVIDER } from "./user-profile-types";

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
