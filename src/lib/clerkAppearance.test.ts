import { describe, expect, it } from "vitest";

import { appearance, localization } from "./clerkAppearance";

describe("clerkAppearance", () => {
  it("takes the primary colour from the CSS token", () => {
    expect(appearance.variables?.colorPrimary).toBe("hsl(var(--primary))");
    expect(appearance.variables?.borderRadius).toBe("6px");
  });

  it("styles the form to the design", () => {
    expect(appearance.elements).toMatchObject({
      card: expect.stringContaining("shadow-none"),
      formFieldInput: "h-[52px] rounded-md",
      headerTitle: expect.stringContaining("font-display"),
      footerActionLink: expect.stringContaining("underline"),
    });
  });

  it("carries the owner-approved sign-in and sign-up copy", () => {
    expect(localization).toMatchObject({
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
    });
  });
});
