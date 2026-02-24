 
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

import { UserProfileContext } from "./user-profile-types";

export { UserProfileContext };

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
