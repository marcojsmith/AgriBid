import { describe, it, expect, vi } from "vitest";

import { encryptPII } from "./encryption";

describe("Encryption Utilities Coverage", () => {
  it("should throw error if encryption fails", async () => {
    const originalEncrypt = crypto.subtle.encrypt;
    crypto.subtle.encrypt = vi
      .fn()
      .mockRejectedValue(new Error("Subtle encrypt failed"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(encryptPII("some data")).rejects.toThrow("encryptPII failed");
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
    crypto.subtle.encrypt = originalEncrypt;
  });
});
