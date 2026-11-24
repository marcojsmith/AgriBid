import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

import {
  registerPath,
  safeCallbackPath,
  type RegStep,
} from "@/lib/registrationCopy";

/** What {@link useRegisterParams} returns. */
export interface RegisterParams {
  /** The safe `callbackUrl`, or null. */
  callbackUrl: string | null;
  /** Whether the step was opened to replace a rejected document. */
  replace: boolean;
  /** A registration path that keeps the callback URL. */
  path: (
    step: RegStep | "status" | "",
    options?: { replace?: boolean }
  ) => string;
}

/**
 * Reads the registration query string (`callbackUrl`, `replace`) and builds
 * registration paths that keep the callback URL.
 *
 * @returns The params and a path builder
 */
export function useRegisterParams(): RegisterParams {
  const [params] = useSearchParams();
  const callbackUrl = safeCallbackPath(params.get("callbackUrl"));
  const replace = params.get("replace") === "1";
  const path = useCallback(
    (step: RegStep | "status" | "", options?: { replace?: boolean }) =>
      registerPath(step, { callbackUrl, replace: options?.replace }),
    [callbackUrl]
  );
  return { callbackUrl, replace, path };
}
