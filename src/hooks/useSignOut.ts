import { createContext, useCallback } from "react";
import { useClerk } from "@clerk/clerk-react";
import { toast } from "sonner";

/**
 * Lets the dev-only design-system page render the Account page outside
 * `ClerkProvider`: a provider above it supplies a stand-in sign-out. Null (the
 * default) means the real Clerk sign-out is used.
 */
export const SignOutOverride = createContext<(() => Promise<void>) | null>(
  null
);

/**
 * The Clerk sign-out shared by the header menu and the Account page: signs out,
 * returns to the home page and shows a toast either way.
 *
 * @returns A function that signs the user out
 */
export function useSignOut(): () => Promise<void> {
  const { signOut } = useClerk();
  return useCallback(async () => {
    try {
      await signOut({ redirectUrl: "/" });
      void toast.success("Signed out successfully");
    } catch (err) {
      console.error("Sign out failed:", err);
      void toast.error("Failed to sign out. Please try again.");
    }
  }, [signOut]);
}
