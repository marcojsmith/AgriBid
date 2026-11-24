import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { IdTypeToggle } from "./IdTypeToggle";

describe("IdTypeToggle", () => {
  it("groups two pressed-state buttons", () => {
    render(<IdTypeToggle value="sa_id" onChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: "ID type" })).toBeInTheDocument();
    const saId = screen.getByRole("button", { name: "SA ID" });
    const passport = screen.getByRole("button", { name: "Passport" });
    expect(saId).toHaveAttribute("aria-pressed", "true");
    expect(passport).toHaveAttribute("aria-pressed", "false");
    expect(saId).toHaveClass(
      "bg-primary",
      "text-primary-foreground",
      "min-h-12"
    );
    expect(passport).not.toHaveClass("bg-primary");
    expect(passport).toHaveClass("rounded-md");
  });

  it("reflects passport and reports changes", () => {
    const onChange = vi.fn();
    render(<IdTypeToggle value="passport" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Passport" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "SA ID" }));
    expect(onChange).toHaveBeenCalledWith("sa_id");
  });
});
