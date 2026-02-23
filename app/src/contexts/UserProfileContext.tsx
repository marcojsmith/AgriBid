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

const UserProfileContext = createContext<UserProfile | undefined | null>(undefined);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const userProfile = useQuery(api.users.getMyProfile);

  return (
    <UserProfileContext.Provider value={userProfile}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  // Optional: throw if undefined to ensure usage within provider
  // if (context === undefined) {
  //   throw new Error("useUserProfile must be used within a UserProfileProvider");
  // }
  return context;
}
