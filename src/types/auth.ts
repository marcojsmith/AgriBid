/**
 * Shape of a signed-in user's identity fields.
 */
export type User = {
  id: string;
  email?: string | null;
  name?: string | null;
};

/**
 * Wraps a {@link User} as returned by the app's session/auth hooks.
 */
export type Session = {
  user: User;
};

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
