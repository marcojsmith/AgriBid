import { describe, it, expect, vi } from "vitest";

/** Minimal typed shape of the dynamically imported encryption module. */
type EncryptionModule = {
  encryptPII: (value: string | null | undefined) => Promise<string | undefined>;
  decryptPII: (value: string | null | undefined) => Promise<string | undefined>;
};

/**
 * Dynamically imports a fresh copy of the encryption module. The query string
 * forces Vitest to re-evaluate the module instead of reusing the cache.
 *
 * @returns The encryption module functions.
 */
async function loadEncryptionModule(): Promise<EncryptionModule> {
  // @ts-expect-error - query param is used to force re-evaluation of module in Vitest
  return (await import("./encryption?final")) as EncryptionModule;
}

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
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {
      // intentional no-op: silences the expected dev-fallback warning
    });

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
    const { encryptPII, decryptPII } = await loadEncryptionModule();
    const plaintext = "sensitive information 123";
    const encrypted = await encryptPII(plaintext);
    expect(encrypted).toBeDefined();

    const decrypted = await decryptPII(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should handle null and undefined inputs", async () => {
    const { encryptPII, decryptPII } = await loadEncryptionModule();
    expect(await encryptPII(undefined)).toBeUndefined();
    expect(await encryptPII(null)).toBeUndefined();
    expect(await decryptPII(undefined)).toBeUndefined();
    expect(await decryptPII(null)).toBeUndefined();
  });

  it("should passthrough non-encrypted strings (legacy)", async () => {
    const { decryptPII } = await loadEncryptionModule();
    const legacy = "plain.text";
    expect(await decryptPII(legacy)).toBe(legacy);

    const notFormatted = "just some text";
    expect(await decryptPII(notFormatted)).toBe(notFormatted);
  });

  it("should throw error if encryption fails", async () => {
    const { encryptPII } = await loadEncryptionModule();
    const originalEncrypt = crypto.subtle.encrypt;
    crypto.subtle.encrypt = vi
      .fn()
      .mockRejectedValue(new Error("Subtle encrypt failed"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {
      // intentional no-op: silences the expected encryption-failure error
    });

    await expect(encryptPII("some data")).rejects.toThrow("encryptPII failed");
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
    crypto.subtle.encrypt = originalEncrypt;
  });

  it("should throw error if decryption fails on apparently encrypted data", async () => {
    const { decryptPII } = await loadEncryptionModule();
    const iv = btoa("123456789012");
    const data = btoa("corrupted-data-with-enough-length");
    const encrypted = `${iv}.${data}`;

    const spy = vi.spyOn(console, "error").mockImplementation(() => {
      // intentional no-op: silences the expected decryption-failure error
    });
    await expect(decryptPII(encrypted)).rejects.toThrow("Decryption failed");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should handle non-Error throws in encryptPII", async () => {
    const { encryptPII } = await loadEncryptionModule();
    const originalEncrypt = crypto.subtle.encrypt;
    crypto.subtle.encrypt = vi
      .fn()
      .mockRejectedValue("Generic encryption error");

    await expect(encryptPII("test")).rejects.toThrow(
      "encryptPII failed: Generic encryption error"
    );

    crypto.subtle.encrypt = originalEncrypt;
  });

  it("should handle non-Error throws in decryptPII", async () => {
    const { decryptPII } = await loadEncryptionModule();
    const iv = btoa("123456789012");
    const data = btoa("some-data");
    const encrypted = `${iv}.${data}`;

    const originalDecrypt = crypto.subtle.decrypt;
    crypto.subtle.decrypt = vi
      .fn()
      .mockRejectedValue("Generic decryption error");

    await expect(decryptPII(encrypted)).rejects.toThrow(
      "Decryption failed: Generic decryption error"
    );

    crypto.subtle.decrypt = originalDecrypt;
  });
});
