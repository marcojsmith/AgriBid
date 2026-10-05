import type { FunctionReturnType } from "convex/server";
import type { api } from "convex/_generated/api";

import { createTypedContext } from "../contexts/createTypedContext";

/**
 * The signed-in user's profile exactly as `users.getMyProfile` returns it.
 *
 * Derived from the query's return validator rather than hand-rolled fields, so
 * consumers under the provider always see the fields the backend actually
 * sends.
 */
export type UserProfile = FunctionReturnType<typeof api.users.getMyProfile>;

export const [UserProfileContext, useUserProfile] =
  createTypedContext<UserProfile>("UserProfile");
