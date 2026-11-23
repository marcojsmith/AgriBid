import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Banner } from "./Banner";

describe("Banner", () => {
  it.each([
    ["ok", "bg-ok-soft", "status"],
    ["warn", "bg-warn-soft", "alert"],
    ["urgent", "bg-urgent-soft", "alert"],
    ["info", "bg-primary-soft", "status"],
    ["sold", "bg-sold-soft", "status"],
  ] as const)("renders %s with its tone and role", (kind, bg, role) => {
    render(<Banner kind={kind}>Message</Banner>);
    const el = screen.getByRole(role);
    expect(el).toHaveAttribute("data-kind", kind);
    expect(el).toHaveClass(bg, "rounded-md");
    expect(el).toHaveTextContent("Message");
    expect(el.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("merges className", () => {
    render(
      <Banner kind="ok" className="extra">
        You&apos;re leading
      </Banner>
    );
    expect(screen.getByRole("status")).toHaveClass("extra");
  });
});
