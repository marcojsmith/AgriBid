import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { WhatsAppButton, WhatsAppGlyph } from "./WhatsAppButton";

describe("WhatsAppButton", () => {
  it("is a logo-only link named 'WhatsApp us' that opens safely in a new tab", () => {
    render(<WhatsAppButton href="https://wa.me/27837000000" />);
    const link = screen.getByRole("link", { name: "WhatsApp us" });
    expect(link).toHaveAttribute("href", "https://wa.me/27837000000");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveClass("size-11");
    expect(link).toHaveTextContent("");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("accepts a custom label and className", () => {
    render(
      <WhatsAppButton
        href="https://wa.me/1"
        label="Chat about lot 3"
        className="extra"
      />
    );
    expect(screen.getByRole("link", { name: "Chat about lot 3" })).toHaveClass(
      "extra"
    );
  });

  it("renders the glyph with a custom size class", () => {
    const { container } = render(<WhatsAppGlyph className="size-5" />);
    expect(container.querySelector("svg")).toHaveClass("size-5");
  });
});
