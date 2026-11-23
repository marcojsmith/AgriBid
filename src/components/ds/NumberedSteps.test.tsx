import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { NumberedSteps } from "./NumberedSteps";

describe("NumberedSteps", () => {
  it("renders an ordered list with square numbers", () => {
    render(
      <NumberedSteps
        className="extra"
        steps={["Invoice by email", "Pay by EFT within 48 hours", "Collect"]}
      />
    );
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(list).toHaveClass("extra");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    const badge = items[1]?.querySelector("span");
    expect(badge).toHaveTextContent("2");
    expect(badge).toHaveClass("rounded-sm", "size-7");
    expect(badge).not.toHaveClass("rounded-full");
    expect(items[1]).toHaveTextContent("Pay by EFT within 48 hours");
  });

  it("renders nothing inside an empty list", () => {
    render(<NumberedSteps steps={[]} />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
