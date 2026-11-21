import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { EventMosaic } from "./EventMosaic";
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

describe("EventMosaic", () => {
  const photo = (n: number) => ({
    src: `/p${String(n)}.jpg`,
    alt: `Photo ${String(n)}`,
  });

  it("falls back to the empty state with no photos", () => {
    render(<EventMosaic photos={[]} emptyAlt="No photos for this sale" />);
    expect(
      screen.getByRole("img", { name: "No photos for this sale" })
    ).toBeInTheDocument();
  });

  it("renders a single full-frame photo", () => {
    const { container } = render(
      <EventMosaic photos={[photo(1)]} emptyAlt="x" />
    );
    expect(screen.getByAltText("Photo 1")).toBeInTheDocument();
    expect(container.querySelector("[data-slot=event-mosaic]")).toBeNull();
  });

  it("renders two photos side by side", () => {
    const { container } = render(
      <EventMosaic photos={[photo(1), photo(2)]} emptyAlt="x" />
    );
    const grid = container.querySelector("[data-slot=event-mosaic]");
    expect(grid).toHaveClass("grid-cols-2");
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("renders one large and two small photos and ignores extras", () => {
    const { container } = render(
      <EventMosaic
        photos={[photo(1), photo(2), photo(3), photo(4)]}
        emptyAlt="x"
      />
    );
    const grid = container.querySelector("[data-slot=event-mosaic]");
    expect(grid).toHaveAttribute("data-count", "3");
    expect(grid).toHaveClass("grid-cols-3", "aspect-video");
    expect(screen.getAllByRole("img")).toHaveLength(3);
    expect(screen.queryByAltText("Photo 4")).not.toBeInTheDocument();
  });
});
