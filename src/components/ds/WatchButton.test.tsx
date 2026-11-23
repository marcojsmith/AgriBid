import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { WatchButton } from "./WatchButton";

describe("WatchButton", () => {
  it("names the action when not watching and calls onToggle", () => {
    const onToggle = vi.fn();
    render(<WatchButton watching={false} onToggle={onToggle} />);
    const btn = screen.getByRole("button", { name: "Watch this lot" });
    expect(btn).toHaveAttribute("data-watching", "false");
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("names the state when watching and fills the heart", () => {
    render(<WatchButton watching onToggle={() => undefined} />);
    const btn = screen.getByRole("button", { name: "Watching this lot" });
    expect(btn.querySelector("svg")).toHaveClass("fill-watch-on");
  });

  it("uses a custom subject and merges className", () => {
    render(
      <WatchButton
        watching={false}
        subject="lot 3, John Deere"
        className="absolute"
        onToggle={() => undefined}
      />
    );
    expect(
      screen.getByRole("button", { name: "Watch lot 3, John Deere" })
    ).toHaveClass("absolute", "size-12");
  });
});
