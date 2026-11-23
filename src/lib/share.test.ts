import { afterEach, describe, it, expect, vi } from "vitest";

import { shareOrCopy } from "./share";

const PAYLOAD = {
  title: "John Deere 8370RT",
  text: "John Deere 8370RT on AgriBid, closes soon",
  url: "https://agribid.example/lots/1",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubNavigator(value: Partial<Navigator>) {
  vi.stubGlobal("navigator", value);
}

describe("shareOrCopy", () => {
  it("uses the native share sheet when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share });
    await expect(shareOrCopy(PAYLOAD)).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith(PAYLOAD);
  });

  it("reports cancelled when the user dismisses the sheet", async () => {
    stubNavigator({
      share: vi.fn().mockRejectedValue(new DOMException("x", "AbortError")),
    });
    await expect(shareOrCopy(PAYLOAD)).resolves.toBe("cancelled");
  });

  it("falls back to copying when the share sheet errors", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({
      share: vi.fn().mockRejectedValue(new Error("boom")),
      clipboard: { writeText } as unknown as Clipboard,
    });
    await expect(shareOrCopy(PAYLOAD)).resolves.toBe("copied");
  });

  it("copies when canShare rejects the payload", async () => {
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({
      share,
      canShare: () => false,
      clipboard: { writeText } as unknown as Clipboard,
    });
    await expect(shareOrCopy(PAYLOAD)).resolves.toBe("copied");
    expect(share).not.toHaveBeenCalled();
  });

  it("copies text and link when there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ clipboard: { writeText } as unknown as Clipboard });
    await expect(shareOrCopy(PAYLOAD)).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(`${PAYLOAD.text} ${PAYLOAD.url}`);
  });

  it("reports failed when the clipboard is blocked", async () => {
    stubNavigator({
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      } as unknown as Clipboard,
    });
    await expect(shareOrCopy(PAYLOAD)).resolves.toBe("failed");
  });
});
