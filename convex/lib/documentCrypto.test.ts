import { afterEach, describe, expect, it, vi } from "vitest";

import { decryptBytes, encryptBytes } from "./documentCrypto";
import { sniffDocumentType } from "./documentSniff";

const KEY_A = Buffer.alloc(32, 7).toString("base64");
const KEY_B = Buffer.alloc(32, 9).toString("base64");

/**
 * Copies bytes into a fresh ArrayBuffer.
 *
 * @param values - Byte values
 * @returns The buffer
 */
function buf(values: number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("documentCrypto", () => {
  it("round-trips and lays out IV + ciphertext + tag", async () => {
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", KEY_A);
    const plain = buf([1, 2, 3, 4, 5]);
    const sealed = await encryptBytes(plain);
    expect(sealed.byteLength).toBe(12 + 5 + 16);
    expect(new Uint8Array(sealed).slice(12, 17)).not.toEqual(
      new Uint8Array(plain)
    );
    expect(new Uint8Array(await decryptBytes(sealed))).toEqual(
      new Uint8Array(plain)
    );
  });

  it("uses a fresh IV per file", async () => {
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", KEY_A);
    const a = new Uint8Array(await encryptBytes(buf([1, 2, 3])));
    const b = new Uint8Array(await encryptBytes(buf([1, 2, 3])));
    expect(a.slice(0, 12)).not.toEqual(b.slice(0, 12));
  });

  it("fails when a ciphertext byte is tampered with", async () => {
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", KEY_A);
    const sealed = new Uint8Array(await encryptBytes(buf([1, 2, 3, 4])));
    sealed[13] ^= 0xff;
    await expect(decryptBytes(sealed.buffer)).rejects.toThrow();
  });

  it("fails under a different key", async () => {
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", KEY_A);
    const sealed = await encryptBytes(buf([1, 2, 3, 4]));
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", KEY_B);
    await expect(decryptBytes(sealed)).rejects.toThrow();
  });

  it("rejects a blob shorter than IV + tag", async () => {
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", KEY_A);
    await expect(decryptBytes(buf([1, 2, 3]))).rejects.toThrow(/too short/);
  });

  it("throws when the key is not 32 bytes", async () => {
    vi.stubEnv(
      "DOCUMENT_ENCRYPTION_KEY",
      Buffer.alloc(16, 1).toString("base64")
    );
    await expect(encryptBytes(buf([1]))).rejects.toThrow(/exactly 32 bytes/);
  });

  it("throws when the key is not valid base64", async () => {
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", "***not base64***");
    await expect(encryptBytes(buf([1]))).rejects.toThrow(/not valid base64/);
  });

  it("fails closed in production when the key is missing, even with the dev flag", async () => {
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", "");
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("ALLOW_DOCUMENT_DEV_FALLBACK", "true");
    await expect(encryptBytes(buf([1]))).rejects.toThrow(
      /missing in production/
    );
  });

  it("fails closed outside production when the key is missing and no flag is set", async () => {
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", "");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("ALLOW_DOCUMENT_DEV_FALLBACK", "");
    await expect(encryptBytes(buf([1]))).rejects.toThrow(/is required/);
  });

  it("uses the dev key only behind the explicit flag", async () => {
    vi.stubEnv("DOCUMENT_ENCRYPTION_KEY", "");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("ALLOW_DOCUMENT_DEV_FALLBACK", "true");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sealed = await encryptBytes(buf([9, 8, 7]));
    expect(new Uint8Array(await decryptBytes(sealed))).toEqual(
      new Uint8Array([9, 8, 7])
    );
    expect(warn).toHaveBeenCalled();
  });
});

describe("sniffDocumentType", () => {
  const ascii = (text: string): number[] =>
    Array.from(text, (c) => c.charCodeAt(0));

  it("recognises every allowed type", () => {
    expect(sniffDocumentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      "image/jpeg"
    );
    expect(
      sniffDocumentType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))
    ).toBe("image/png");
    expect(
      sniffDocumentType(
        new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")])
      )
    ).toBe("image/webp");
    for (const brand of ["heic", "heix", "mif1", "heif"]) {
      expect(
        sniffDocumentType(
          new Uint8Array([0, 0, 0, 24, ...ascii("ftyp"), ...ascii(brand)])
        )
      ).toBe("image/heic");
    }
    expect(sniffDocumentType(new Uint8Array(ascii("%PDF-1.7")))).toBe(
      "application/pdf"
    );
  });

  it("rejects svg, executables, short input and look-alikes", () => {
    expect(
      sniffDocumentType(new Uint8Array(ascii('<svg xmlns="http://www.w3.org')))
    ).toBeNull();
    expect(
      sniffDocumentType(new Uint8Array(ascii("MZ\u0090\u0000")))
    ).toBeNull();
    expect(sniffDocumentType(new Uint8Array([]))).toBeNull();
    expect(sniffDocumentType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    // RIFF but not WEBP (e.g. WAV)
    expect(
      sniffDocumentType(
        new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WAVE")])
      )
    ).toBeNull();
    // ftyp with an unrelated brand (e.g. mp4)
    expect(
      sniffDocumentType(
        new Uint8Array([0, 0, 0, 24, ...ascii("ftyp"), ...ascii("isom")])
      )
    ).toBeNull();
  });
});
