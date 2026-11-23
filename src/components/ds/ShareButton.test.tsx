import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";

import { ShareButton } from "./ShareButton";

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

describe("ShareButton", () => {
  it("is named Share and reports the result of the click", async () => {
    stubNavigator({ share: vi.fn().mockResolvedValue(undefined) });
    const onResult = vi.fn();
    render(<ShareButton {...PAYLOAD} onResult={onResult} className="extra" />);
    const btn = screen.getByRole("button", { name: "Share" });
    expect(btn).toHaveClass("size-11", "extra");
    fireEvent.click(btn);
    await waitFor(() => {
      expect(onResult).toHaveBeenCalledWith("shared");
    });
  });

  it("works without an onResult callback", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share });
    render(<ShareButton {...PAYLOAD} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => {
      expect(share).toHaveBeenCalled();
    });
  });
});
