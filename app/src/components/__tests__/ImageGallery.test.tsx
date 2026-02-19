// app/src/components/__tests__/ImageGallery.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { ImageGallery } from "../ImageGallery";
import { describe, it, expect, vi } from "vitest";

describe("ImageGallery", () => {
  const mockImages = [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg",
    "https://example.com/image3.jpg",
  ];

  it("renders the first image as the hero by default", () => {
    render(<ImageGallery images={mockImages} title="Test Equipment" />);

    const heroImage = screen.getByAltText("Test Equipment - Main");
    expect(heroImage).toHaveAttribute("src", mockImages[0]);
  });

  it("updates the hero image when a thumbnail is clicked", () => {
    render(<ImageGallery images={mockImages} title="Test Equipment" />);

    const thumbnails = screen.getAllByRole("button", { name: /View image/i });

    // Click the second thumbnail
    fireEvent.click(thumbnails[1]);

    const heroImage = screen.getByAltText("Test Equipment - Main");
    expect(heroImage).toHaveAttribute("src", mockImages[1]);
  });

  it("opens the lightbox when the main image is clicked", () => {
    render(<ImageGallery images={mockImages} title="Test Equipment" />);

    const mainImageButton = screen.getByLabelText("Open full-screen gallery");
    fireEvent.click(mainImageButton);

    // Check if lightbox content is visible (dialog role)
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByAltText("Test Equipment - Full Screen")).toHaveAttribute(
      "src",
      mockImages[0],
    );
  });

  it("prevents lightbox closure when navigation buttons are clicked", () => {
    render(<ImageGallery images={mockImages} title="Test Equipment" />);

    // Open lightbox
    const mainImageButton = screen.getByLabelText("Open full-screen gallery");
    fireEvent.click(mainImageButton);

    const nextButton = screen.getByLabelText("Next image");
    const stopPropagationSpy = vi.spyOn(MouseEvent.prototype, "stopPropagation");

    fireEvent.click(nextButton);

    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    stopPropagationSpy.mockRestore();
  });

  it("applies overlay only to inactive thumbnails", () => {
    render(<ImageGallery images={mockImages} title="Test Equipment" />);

    // Index 0 is active by default
    // We look for the overlay div which has bg-black/5 class
    // In our implementation it's: <div className="absolute inset-0 bg-black/5 ..." />
    const overlays = screen.queryAllByRole("button", { name: /View image/i })
      .map(button => button.querySelector(".bg-black\\/5"));

    expect(overlays[0]).toBeNull(); // Active thumbnail has no overlay
    expect(overlays[1]).not.toBeNull(); // Inactive thumbnail has overlay
    expect(overlays[2]).not.toBeNull(); // Inactive thumbnail has overlay
  });
});
