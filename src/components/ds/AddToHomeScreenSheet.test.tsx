import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddToHomeScreenSheet } from "./AddToHomeScreenSheet";

describe("AddToHomeScreenSheet", () => {
  it("shows the three steps", () => {
    render(<AddToHomeScreenSheet open onOpenChange={() => undefined} />);
    expect(
      screen.getByRole("dialog", { name: "Get reminders on iPhone" })
    ).toBeInTheDocument();
    expect(screen.getByText("Add to Home Screen")).toBeInTheDocument();
    expect(
      screen.getByText(/Open AgriBid from your Home Screen/)
    ).toBeInTheDocument();
  });

  it("closes from the Close button", () => {
    const onOpenChange = vi.fn();
    render(<AddToHomeScreenSheet open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[1]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders nothing when closed", () => {
    render(
      <AddToHomeScreenSheet open={false} onOpenChange={() => undefined} />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
