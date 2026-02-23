import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export interface UserProfile {
  userId?: string | null;
  _id?: string;
  email?: string;
  profile?: {
    userId: string;
    _id: string;
    _creationTime: number;
    role: "buyer" | "seller" | "admin";
    isVerified: boolean;
    kycStatus?: "pending" | "verified" | "rejected" | null;
    kycDocuments?: string[];
    kycRejectionReason?: string;
    firstName?: string;
    lastName?: string;
    idNumber?: string;
    kycEmail?: string;
    bio?: string;
    phoneNumber?: string;
    companyName?: string;
    createdAt: number;
    updatedAt: number;
  } | null;
}

const NO_PROVIDER = Symbol("NO_PROVIDER");

const UserProfileContext = createContext<UserProfile | undefined | null | typeof NO_PROVIDER>(NO_PROVIDER);

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
 * Accesses the current user's profile from the UserProfile context.
 *
 * @returns The `UserProfile` value stored in context, `null` if the user has no profile, or `undefined` if the profile is still loading.
 * @throws {Error} If called outside of a `UserProfileProvider`.
 */
export function useUserProfile() {
  const context = useContext(UserProfileContext);
  // Throw if sentinel to ensure usage within provider
  if (context === NO_PROVIDER) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
}