import { describe, it, expect, vi } from "vitest";

describe("Encryption Utilities Global Scope Coverage", () => {
  it("should throw if in production and key is missing", async () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("PII_ENCRYPTION_KEY", "");

    // @ts-expect-error - query param is used to force re-evaluation of module in Vitest
    await expect(import("./encryption?test1")).rejects.toThrow(
      "PII_ENCRYPTION_KEY environment variable is missing in production"
    );
    vi.unstubAllEnvs();
  });

  it("should throw if key is not 32 bytes", async () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "too-short");

    // @ts-expect-error - query param is used to force re-evaluation of module in Vitest
    await expect(import("./encryption?test2")).rejects.toThrow(
      "must be exactly 32 bytes"
    );
    vi.unstubAllEnvs();
  });

  it("should throw if no key and no dev fallback allowed", async () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("ALLOW_PII_DEV_FALLBACK", "false");

    // @ts-expect-error - query param is used to force re-evaluation of module in Vitest
    await expect(import("./encryption?test3")).rejects.toThrow(
      "PII_ENCRYPTION_KEY is required"
    );
    vi.unstubAllEnvs();
  });

  it("should warn if using dev fallback key", async () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("ALLOW_PII_DEV_FALLBACK", "true");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // @ts-expect-error - query param is used to force re-evaluation of module in Vitest
    await import("./encryption?test4");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("SECURITY WARNING")
    );

    vi.unstubAllEnvs();
    spy.mockRestore();
  });
});

describe("Encryption Utilities Functionality", () => {
  it("should encrypt and decrypt a string successfully", async () => {
    // @ts-expect-error - query param is used to force re-evaluation of module in Vitest
    const { encryptPII, decryptPII } = await import("./encryption?final");
    const plaintext = "sensitive information 123";
    const encrypted = await encryptPII(plaintext);
    expect(encrypted).toBeDefined();

    const decrypted = await decryptPII(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should handle null and undefined inputs", async () => {
    // @ts-expect-error - query param is used to force re-evaluation of module in Vitest
    const { encryptPII, decryptPII } = await import("./encryption?final");
    expect(await encryptPII(undefined)).toBeUndefined();
    expect(await encryptPII(null)).toBeUndefined();
    expect(await decryptPII(undefined)).toBeUndefined();
    expect(await decryptPII(null)).toBeUndefined();
  });

  it("should passthrough non-encrypted strings (legacy)", async () => {
    // @ts-expect-error - query param is used to force re-evaluation of module in Vitest
    const { decryptPII } = await import("./encryption?final");
    const legacy = "plain.text";
    expect(await decryptPII(legacy)).toBe(legacy);

    const notFormatted = "just some text";
    expect(await decryptPII(notFormatted)).toBe(notFormatted);
  });

  it("should throw error if encryption fails", async () => {
    // @ts-expect-error - query param is used to force re-evaluation of module in Vitest
    const { encryptPII } = await import("./encryption?final");
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

  it("should throw error if decryption fails on apparently encrypted data", async () => {
    // @ts-expect-error - query param is used to force re-evaluation of module in Vitest
    const { decryptPII } = await import("./encryption?final");
    const iv = btoa("123456789012");
    const data = btoa("corrupted-data-with-enough-length");
    const encrypted = `${iv}.${data}`;

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(decryptPII(encrypted)).rejects.toThrow("Decryption failed");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
