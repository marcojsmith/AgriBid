import type { ClerkProviderProps } from "@clerk/clerk-react";

/** Clerk's `appearance` prop, taken from the provider so no extra package is needed. */
export type ClerkAppearance = NonNullable<ClerkProviderProps["appearance"]>;

/** Clerk's `localization` prop. */
export type ClerkLocalization = NonNullable<ClerkProviderProps["localization"]>;

/**
 * Clerk's sign-in and sign-up forms, styled to match the app (design
 * `register-r2`): the theme's primary colour and 6px radius, Inter, a flat
 * bordered card, 52px inputs, 48px buttons and a Lora heading. Colours come
 * from the CSS tokens, so dark mode follows the theme.
 */
export const appearance: ClerkAppearance = {
  // Matches the `@layer` order in `index.css`: without it Clerk's unlayered
  // styles beat Tailwind 4's layered utilities.
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "hsl(var(--primary))",
    borderRadius: "6px",
    fontFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
  elements: {
    card: "rounded-lg border border-border shadow-none bg-card",
    headerTitle: "font-display text-[28px] font-semibold",
    formFieldInput: "h-[52px] rounded-md",
    formButtonPrimary: "h-12 rounded-md text-[15px] font-semibold normal-case",
    socialButtonsBlockButton:
      "h-12 rounded-md text-[15px] font-semibold normal-case",
    footerActionLink: "underline text-primary font-semibold",
  },
};

/** Owner-approved sign-in and sign-up copy. */
export const localization: ClerkLocalization = {
  signIn: {
    start: {
      title: "Sign in to bid",
      subtitle: "Welcome back.",
      actionText: "New to AgriBid?",
      actionLink: "Create an account",
    },
  },
  signUp: {
    start: {
      title: "Create your account",
      subtitle: "Then we ask for your ID details.",
      actionText: "Have an account?",
      actionLink: "Sign in",
    },
  },
  formFieldLabel__emailAddress: "Email address",
  formFieldInputPlaceholder__emailAddress: "you@example.co.za",
};
