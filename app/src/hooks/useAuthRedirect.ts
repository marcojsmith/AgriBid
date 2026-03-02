import { useSession } from "@/lib/auth-client";
import { isValidCallbackUrl } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

/**
 * Custom hook that provides authentication redirect functionality.
 * Ensures user is authenticated before proceeding with protected actions.
 */
export function useAuthRedirect() {
  const { data: session, isPending } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

  const ensureAuthenticated = (
    message: string = "Please sign in to continue"
  ) => {
    if (!session && !isPending) {
      toast.info(message);
      const rawUrl = location.pathname;
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
