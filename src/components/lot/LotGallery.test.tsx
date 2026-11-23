import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { buildSlides } from "@/lib/lotPage";

import { LotGallery } from "./LotGallery";

const slides = buildSlides(
  [
    { url: "a.jpg", angle: "front" },
    { url: "b.jpg", angle: "hour_meter" },
    { url: "c.jpg" },
  ],
  "cold.mp4"
);

function renderGallery(viewerAt: number | null = null) {
  const onViewerChange = vi.fn();
  const view = render(
    <LotGallery
      slides={slides}
      title="New Holland T6070"
      actions={<button type="button">heart</button>}
      viewerAt={viewerAt}
      onViewerChange={onViewerChange}
    />
  );
  return { ...view, onViewerChange };
}

describe("LotGallery", () => {
  beforeAll(() => {
    // jsdom has no element scrolling.
    Element.prototype.scrollTo = vi.fn();
  });

  it("shows the cold-start video first with the counter and caption", () => {
    const { container } = renderGallery();
    expect(container.querySelector("video")).toHaveAttribute("src", "cold.mp4");
    expect(screen.getByText("1 / 4 · Cold-start video")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "heart" })).toBeInTheDocument();
  });

  it("has a thumbnail per slide, captioned by angle", () => {
    renderGallery();
    const thumbs = screen.getByRole("list", { name: "Photo thumbnails" });
    expect(thumbs.querySelectorAll("button")).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: "Show Hour meter" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show Front" })
    ).toBeInTheDocument();
  });

  it("tapping a thumbnail moves the counter", () => {
    renderGallery();
    fireEvent.click(screen.getByRole("button", { name: "Show Hour meter" }));
    expect(screen.getByText("3 / 4 · Hour meter")).toBeInTheDocument();
  });

  it("tapping a photo or the full-screen button opens the viewer", () => {
    const { onViewerChange } = renderGallery();
    fireEvent.click(
      screen.getByRole("button", { name: "Open photo 2 full screen" })
    );
    expect(onViewerChange).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "View full screen" }));
    expect(onViewerChange).toHaveBeenLastCalledWith(0);
  });

  it("the viewer shows the slide, moves with the buttons and arrow keys, and closes", () => {
    const { onViewerChange } = renderGallery(2);
    const viewer = screen.getByRole("dialog");
    expect(viewer).toHaveTextContent("3 / 4 · Hour meter");
    fireEvent.click(screen.getByRole("button", { name: "Next photo" }));
    expect(onViewerChange).toHaveBeenLastCalledWith(3);
    fireEvent.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(onViewerChange).toHaveBeenLastCalledWith(1);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onViewerChange).toHaveBeenLastCalledWith(3);
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onViewerChange).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onViewerChange).toHaveBeenLastCalledWith(null);
  });

  it("the viewer has no previous button on the first slide and no next on the last", () => {
    const { rerender, onViewerChange } = renderGallery(0);
    expect(screen.queryByRole("button", { name: "Previous photo" })).toBeNull();
    rerender(
      <LotGallery
        slides={slides}
        title="x"
        viewerAt={3}
        onViewerChange={onViewerChange}
      />
    );
    expect(screen.queryByRole("button", { name: "Next photo" })).toBeNull();
  });

  it("shows an empty state when there are no photos", () => {
    render(
      <LotGallery
        slides={[]}
        title="x"
        viewerAt={null}
        onViewerChange={vi.fn()}
      />
    );
    expect(
      screen.getByRole("img", { name: /no photo yet/i })
    ).toBeInTheDocument();
  });
});
