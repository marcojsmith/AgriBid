import { describe, it, expect, beforeAll } from "vitest";

import { encryptPII, decryptPII } from "./encryption";

describe("Encryption Utilities", () => {
  beforeAll(() => {
    // Ensure environment variables are set for the module load
    // Note: encryption.ts loads these at the top level, so they might
    // already be fixed if the module was already imported.
    // In Vitest, we might need to use vi.stubEnv or similar if we want to test different envs.
  });

  it("should encrypt and decrypt a string successfully", async () => {
    const plaintext = "Sensitive PII Data";
    const encrypted = await encryptPII(plaintext);

    expect(encrypted).toBeDefined();
    expect(encrypted).toContain(".");
    expect(encrypted).not.toBe(plaintext);

    const decrypted = await decryptPII(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should return undefined if input is undefined or null", async () => {
    expect(await encryptPII(undefined)).toBeUndefined();
    // Intentionally testing null to ensure robust runtime behavior for edge cases
    expect(await encryptPII(null as unknown as string)).toBeUndefined();
    expect(await decryptPII(undefined)).toBeUndefined();
    expect(await decryptPII(null as unknown as string)).toBeUndefined();
  });

  it("should return original string if it is not in encrypted format", async () => {
    const plaintext = "regular.string";
    const decrypted = await decryptPII(plaintext);
    expect(decrypted).toBe(plaintext);

    const anotherPlaintext = "plain";
    expect(await decryptPII(anotherPlaintext)).toBe(anotherPlaintext);
  });

  it("should handle base64 encoding/decoding of different lengths", async () => {
    const data = [
      "short",
      "a bit longer string with spaces and symbols !@#$%^&*()",
      "very ".repeat(100) + "long string",
      "Unicode: 🚜 🌾 🚜",
    ];

    for (const item of data) {
      const encrypted = await encryptPII(item);
      const decrypted = await decryptPII(encrypted);
      expect(decrypted).toBe(item);
    }
  });

  it("should fail decryption if format is invalid but looks like encrypted", async () => {
    // Valid base64 but wrong IV length (IV must be 12 bytes)
    const invalidIv = btoa("short-iv"); // 8 bytes
    const dummyData = btoa("some-data");
    const invalidEncrypted = `${invalidIv}.${dummyData}`;

    // decryptPII returns the input if IV length is not 12
    const result = await decryptPII(invalidEncrypted);
    expect(result).toBe(invalidEncrypted);
  });

  it("should throw error if decryption fails (e.g. tampered data)", async () => {
    const plaintext = "Secret Message";
    const encrypted = await encryptPII(plaintext);
    const [iv, data] = encrypted!.split(".");

    // Tamper with the encrypted data (change one character to another valid base64 char)
    const charToReplace = data[0];
    const replacement = charToReplace === "A" ? "B" : "A";
    const tamperedData = replacement + data.substring(1);
    const tamperedEncrypted = `${iv}.${tamperedData}`;

    // Ensure it's still valid base64 so it doesn't return the input string
    const base64Regex =
      /^(?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
    expect(base64Regex.test(tamperedData)).toBe(true);

    await expect(decryptPII(tamperedEncrypted)).rejects.toThrow(
      "Decryption failed"
    );
  });
});
