// app/src/types/auth.ts
import { authClient } from "../lib/auth-client";

export type Session = typeof authClient.$Infer.Session;
export type User = typeof authClient.$Infer.Session.user;

/**
 * Shared type for users with role and verification metadata.
 * Used to avoid manual type assertions across the codebase.
 */
export type UserWithRole = User & {
  role?: "admin" | "seller" | "buyer" | string;
  isVerified?: boolean;
};

export type SessionWithRole = Session & {
  user: UserWithRole;
};

export interface UserProfileMetadata {
  _id: string;
  userId: string;
  role: "admin" | "seller" | "buyer" | string;
  isVerified: boolean;
  kycStatus?: "none" | "pending" | "verified" | "rejected";
  createdAt: number;
  updatedAt: number;
}

export interface UserDataWithProfile {
  _id?: string | null;
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  profile?: UserProfileMetadata | null;
}

