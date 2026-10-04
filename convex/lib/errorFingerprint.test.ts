import { describe, it, expect } from "vitest";

import { generateFingerprint } from "./errorFingerprint";

describe("errorFingerprint", () => {
  describe("generateFingerprint", () => {
    it("should generate consistent fingerprint for same error", () => {
      const f1 = generateFingerprint(
        "TypeError",
        "Cannot read properties of undefined (reading 'foo')",
        null
      );
      const f2 = generateFingerprint(
        "TypeError",
        "Cannot read properties of undefined (reading 'foo')"
      );
      expect(f1).toBe(f2);
    });

    it("should normalize messages", () => {
      const f1 = generateFingerprint("TypeError", "Error 123");
      const f2 = generateFingerprint("TypeError", "Error   123!");
      expect(f1).toBe(f2);
    });

    it("should include top frame if available", () => {
      const stack = `TypeError: Cannot read properties of undefined (reading 'foo')
    at Object.<anonymous> (/app/src/test.ts:10:15)
    at Module._compile (node:internal/modules/cjs/loader:1356:14)`;

      const f1 = generateFingerprint("TypeError", "Test", stack);
      expect(f1).toBe("TypeError:test:Object.<anonymous>");
    });

    it("should skip empty lines and random garbage in stack trace", () => {
      const stack = `TypeError: Something went wrong
      
      random line that does not start with at or TypeError
      at MyFunction (/app/src/test.ts:1:1)`;

      const f1 = generateFingerprint("TypeError", "Test", stack);
      expect(f1).toBe("TypeError:test:MyFunction");
    });

    it("covers no stack trace case", () => {
      expect(generateFingerprint("Error", "Message")).toBe("Error:message:");
    });

    it("covers non-standard stack frame format", () => {
      const stack = "Error: msg\n  at /path/to/file.ts:1:1";
      expect(generateFingerprint("Error", "msg", stack)).toBe(
        "Error:msg:/path/to/file.ts:1:1"
      );
    });

    it("skips non-matching lines in stack trace", () => {
      const stack =
        "Random line\nTypeError: Specific Error\nAnother line\nat MyFunc (file.ts:1:1)";
      expect(generateFingerprint("Error", "msg", stack)).toBe(
        "Error:msg:MyFunc"
      );
    });

    it("covers non-matching at lines branch", () => {
      const stack = "Just some text\nMore text";
      expect(generateFingerprint("Error", "msg", stack)).toBe("Error:msg:");
    });
  });
});
