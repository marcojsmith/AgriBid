import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SectionHeader } from "./SectionHeader";
import { StickyActionBar } from "./StickyActionBar";

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

describe("StickyActionBar", () => {
  it("renders children in a phone-only fixed bar with safe-area padding", () => {
    render(
      <StickyActionBar label="Bid actions">
        <button>Place bid</button>
      </StickyActionBar>
    );
    const bar = screen.getByRole("region", { name: "Bid actions" });
    expect(bar).toHaveClass("fixed", "bottom-0", "md:hidden");
    expect(bar.className).toContain("env(safe-area-inset-bottom)");
    expect(
      screen.getByRole("button", { name: "Place bid" })
    ).toBeInTheDocument();
  });

  it("renders nothing when hidden", () => {
    const { container } = render(
      <StickyActionBar hidden>
        <button>Place bid</button>
      </StickyActionBar>
    );
    expect(container).toBeEmptyDOMElement();
  });
});
