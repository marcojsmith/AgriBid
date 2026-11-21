import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
  it("renders an h2 and baseline-aligned controls", () => {
    const { container } = render(
      <SectionHeader
        title="Live lots"
        controls={<button>Sort</button>}
        id="s"
      />
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Live lots" })
    ).toHaveAttribute("id", "s");
    expect(screen.getByRole("button", { name: "Sort" })).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("items-baseline");
  });

  it("omits the controls group when there are none", () => {
    const { container } = render(<SectionHeader title="Only title" />);
    expect(container.firstElementChild?.children).toHaveLength(1);
  });
});
