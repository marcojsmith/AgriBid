import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { StickyActionBar } from "./StickyActionBar";

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
