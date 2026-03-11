import { describe, it, expect } from "vitest";

import { authClient } from "./auth-client";

describe("authClient", () => {
  it("should be initialized", () => {
    expect(authClient).toBeDefined();
  });

  it("should export authentication methods", () => {
    expect(typeof authClient.signIn).toBe("function");
    expect(typeof authClient.signUp).toBe("function");
    expect(typeof authClient.signOut).toBe("function");
    expect(typeof authClient.useSession).toBe("function");
  });
});
