import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { BottomSheet } from "./BottomSheet";

describe("BottomSheet", () => {
  it("renders a titled modal with body, actions and a close button", () => {
    render(
      <BottomSheet
        open
        onOpenChange={() => undefined}
        title="Fees & rules"
        actions={<button>Confirm</button>}
      >
        <p>Premium 12%</p>
      </BottomSheet>
    );
    const sheet = screen.getByRole("dialog", { name: "Fees & rules" });
    expect(sheet).toHaveClass("rounded-t-lg", "bg-card");
    expect(screen.getByRole("heading", { name: "Fees & rules" })).toHaveClass(
      "font-display",
      "text-xl"
    );
    expect(screen.getByText("Premium 12%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass(
      "size-11"
    );
  });

  it("asks to close from the close button and from Escape", () => {
    const onOpenChange = vi.fn();
    render(
      <BottomSheet
        open
        onOpenChange={onOpenChange}
        title="Sheet"
        className="extra"
      >
        body
      </BottomSheet>
    );
    expect(screen.getByRole("dialog")).toHaveClass("extra");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it("renders nothing when closed and has no actions row without actions", () => {
    const { rerender } = render(
      <BottomSheet open={false} onOpenChange={() => undefined} title="Sheet">
        body
      </BottomSheet>
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(
      <BottomSheet open onOpenChange={() => undefined} title="Sheet">
        body
      </BottomSheet>
    );
    expect(
      document.querySelector("[data-slot=bottom-sheet-actions]")
    ).toBeNull();
  });
});
