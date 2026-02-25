import { createContext } from "react";
import type { Id } from "../../convex/_generated/dataModel";

export interface PublicProfile {
  userId: string;
  _id: Id<"profiles">;
  _creationTime: number;
  role: "buyer" | "seller" | "admin";
  isVerified: boolean;
  kycStatus?: "pending" | "verified" | "rejected" | null;
  bio?: string;
  companyName?: string;
  createdAt: number;
  updatedAt: number;
}

export interface KycProfile {
  idNumber?: string;
  phoneNumber?: string;
  kycEmail?: string;
  kycDocuments?: string[];
  kycRejectionReason?: string;
  firstName?: string;
  lastName?: string;
}

export interface UserProfile {
  userId?: string | null;
  _id?: string;
  email?: string;
  profile?: PublicProfile | null;
  kyc?: KycProfile | null;
}

export const NO_PROVIDER = Symbol("NO_PROVIDER");

export const UserProfileContext = createContext<UserProfile | undefined | null>(
  NO_PROVIDER as unknown as UserProfile | undefined | null
);
