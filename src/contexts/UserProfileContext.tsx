import type { ReactNode } from "react";
import { useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import { UserProfileContext } from "../hooks/useUserProfile";

export { UserProfileContext };

/**
 * Supply the current user's profile to descendant components through UserProfileContext.
 *
 * @param props - Component props
 * @param props.children - React nodes to render inside the provider
 * @returns A React element that renders `children` inside a `UserProfileContext.Provider`.
 */
export function UserProfileProvider({ children }: { children: ReactNode }) {
  const userProfile = useQuery(api.users.getMyProfile);

  return (
    <UserProfileContext.Provider value={userProfile}>
      {children}
    </UserProfileContext.Provider>
  );
}
