import { createContext, useContext } from "react";

export const NO_PROVIDER = Symbol("NO_PROVIDER");

/**
 * A generic factory for creating strictly typed React contexts.
 *
 * @param displayName - The name of the context, used in error messages.
 * @returns A tuple containing the Context and the corresponding useContext hook.
 */
export function createTypedContext<T>(displayName: string) {
  const Context = createContext<T | undefined | null>(
    NO_PROVIDER as unknown as T
  );

  const useContextHook = () => {
    const ctx = useContext(Context);
    if ((ctx as unknown) === NO_PROVIDER) {
      throw new Error(
        `use${displayName} must be used within a ${displayName}Provider`
      );
    }
    return ctx;
  };

  return [Context, useContextHook] as const;
}
