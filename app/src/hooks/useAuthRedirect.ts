import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useSession } from "@/lib/auth-client";
import { isValidCallbackUrl } from "@/lib/utils";

/**
 * Custom hook that provides utility functions for handling authentication redirects.
 * @returns Object containing ensureAuthenticated function, session, and isPending status
 */
export function useAuthRedirect() {
  const { data: session, isPending } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  /**
   * Ensures the user is authenticated before performing an action.
   * If not authenticated, redirects to the login page with a callback URL.
   *
   * @param message - Optional message to show in a toast if not authenticated
   * @returns `true` if authenticated, `false` otherwise (including when loading)
   */
  const ensureAuthenticated = (message?: string): boolean => {
    if (isPending) {
      return false;
    }

    if (!session) {
      if (message) {
        toast.info(message);
      }
      const rawUrl = location.pathname + location.search;
      const callbackUrl = isValidCallbackUrl(rawUrl)
        ? encodeURIComponent(rawUrl)
        : "/";
      navigate(`/login?callbackUrl=${callbackUrl}`);
      return false;
    }
    return true;
  };

  return { ensureAuthenticated, session, isPending };
}
