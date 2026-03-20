import { useContext } from "react";

import { UserProfileContext, NO_PROVIDER } from "@/contexts/user-profile-types";

/**
 * Retrieve the current user's profile from the UserProfile context.
 *
 * @returns An object containing userId, _id, email, profile, and kyc properties, `null` when the user has no profile, or `undefined` while the profile is loading.
 * @throws Error If called outside a `UserProfileProvider`.
 */
export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if ((context as unknown) === NO_PROVIDER) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
}
