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
  Context.displayName = displayName;

  const useContextHook = () => {
    const ctx = useContext(Context);
    if ((ctx as unknown) === NO_PROVIDER) {
      // "User" starts with a vowel but is pronounced with a consonant sound ("yoo-zher"),
      // so it gets "a" instead of "an" - this exception preserves grammatically correct error messages
      const isUser = displayName.startsWith("User");
      const article = /^[aeiou]/i.test(displayName) && !isUser ? "an" : "a";
      throw new Error(
        `use${displayName} must be used within ${article} ${displayName}Provider`
      );
    }
    return ctx;
  };

  return [Context, useContextHook] as const;
}
