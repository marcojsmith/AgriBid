import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { PhotoFrame } from "./PhotoFrame";

describe("PhotoFrame", () => {
  it("renders a lazy, cover-fit image with alt text at 4:3 by default", () => {
    render(<PhotoFrame src="/a.jpg" alt="Front of tractor" />);
    const img = screen.getByAltText("Front of tractor");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveClass("object-cover");
    expect(img.parentElement).toHaveClass("aspect-[4/3]", "rounded-lg");
  });

  it("supports 16:9 and eager loading", () => {
    render(<PhotoFrame src="/a.jpg" alt="Hero" ratio="16:9" eager />);
    const img = screen.getByAltText("Hero");
    expect(img).toHaveAttribute("loading", "eager");
    expect(img.parentElement).toHaveClass("aspect-video");
  });

  it("shows a labelled branded empty state without a source", () => {
    render(<PhotoFrame alt="No photo for lot 4" />);
    const el = screen.getByRole("img", { name: "No photo for lot 4" });
    expect(el).toHaveAttribute("data-empty", "true");
    expect(screen.getByText("No photo yet")).toBeInTheDocument();
  });

  it("fills its parent when asked", () => {
    render(<PhotoFrame src="/a.jpg" alt="x" fill />);
    expect(screen.getByAltText("x").parentElement).toHaveClass("size-full");
  });
});
