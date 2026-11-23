import { afterEach, describe, expect, it, vi } from "vitest";

import { getViewSessionId } from "./viewSession";

const VALID = /^[A-Za-z0-9_-]{8,64}$/;

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("getViewSessionId", () => {
  it("makes an id the server accepts and keeps it for the tab", () => {
    const first = getViewSessionId();
    expect(first).toMatch(VALID);
    expect(getViewSessionId()).toBe(first);
  });

  it("replaces a stored value the server would reject", () => {
    sessionStorage.setItem("agribid.viewSession", "bad id!");
    expect(getViewSessionId()).toMatch(VALID);
  });

  it("still returns a valid id when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getViewSessionId()).toMatch(VALID);
  });
});
