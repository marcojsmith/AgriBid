import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PermissionPrompt } from "./PermissionPrompt";

describe("PermissionPrompt", () => {
  it("asks in our own words", () => {
    render(
      <PermissionPrompt
        open
        onOpenChange={() => undefined}
        onAllow={() => undefined}
        description="So we can tell you when this sale opens."
      />
    );
    expect(screen.getByText("Allow notifications?")).toBeInTheDocument();
    expect(
      screen.getByText("So we can tell you when this sale opens.")
    ).toBeInTheDocument();
  });

  it("uses a custom confirm label", () => {
    render(
      <PermissionPrompt
        open
        onOpenChange={() => undefined}
        onAllow={() => undefined}
        description="x"
        allowLabel="Allow alerts"
      />
    );
    expect(
      screen.getByRole("button", { name: "Allow alerts" })
    ).toBeInTheDocument();
  });

  it("calls onAllow and closes on Not now", () => {
    const onAllow = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <PermissionPrompt
        open
        onOpenChange={onOpenChange}
        onAllow={onAllow}
        description="x"
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Allow" }));
    expect(onAllow).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
