import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ImageGallery } from "./ImageGallery";

describe("ImageGallery", () => {
  const mockImages = ["img1.jpg", "img2.jpg", "img3.jpg"];
  const mockTitle = "Test Equipment";

  it("renders empty state when no images provided", () => {
    render(<ImageGallery images={[]} title={mockTitle} />);
    expect(screen.getByText(/Image Pending/i)).toBeDefined();
  });

  it("renders the main image", () => {
    render(<ImageGallery images={mockImages} title={mockTitle} />);
    const mainImg = screen.getByAltText(`${mockTitle} - Main`);
    expect(mainImg.getAttribute("src")).toBe("img1.jpg");
  });

  it("changes active image when thumbnail is clicked", () => {
    render(<ImageGallery images={mockImages} title={mockTitle} />);
    const thumb2 = screen.getByLabelText("View image 2");
    fireEvent.click(thumb2);

    const mainImg = screen.getByAltText(`${mockTitle} - Main`);
    expect(mainImg.getAttribute("src")).toBe("img2.jpg");
  });

  it("opens lightbox on main image click", () => {
    render(<ImageGallery images={mockImages} title={mockTitle} />);
    const trigger = screen.getByLabelText("Open full-screen gallery");
    fireEvent.click(trigger);

    // Check if lightbox content is visible
    expect(screen.getByAltText(`${mockTitle} - Full Screen`)).toBeDefined();
  });

  it("navigates images in lightbox", () => {
    render(<ImageGallery images={mockImages} title={mockTitle} />);
    fireEvent.click(screen.getByLabelText("Open full-screen gallery"));

    const nextBtn = screen.getByLabelText("Next image");
    fireEvent.click(nextBtn);

    const fullScreenImg = screen.getByAltText(`${mockTitle} - Full Screen`);
    expect(fullScreenImg.getAttribute("src")).toBe("img2.jpg");

    const prevBtn = screen.getByLabelText("Previous image");
    fireEvent.click(prevBtn);
    expect(fullScreenImg.getAttribute("src")).toBe("img1.jpg");
  });

  it("wraps around images in lightbox", () => {
    render(<ImageGallery images={mockImages} title={mockTitle} />);
    fireEvent.click(screen.getByLabelText("Open full-screen gallery"));

    const prevBtn = screen.getByLabelText("Previous image");
    fireEvent.click(prevBtn); // Wrap from 0 to 2

    const fullScreenImg = screen.getByAltText(`${mockTitle} - Full Screen`);
    expect(fullScreenImg.getAttribute("src")).toBe("img3.jpg");

    const nextBtn = screen.getByLabelText("Next image");
    fireEvent.click(nextBtn); // Wrap from 2 to 0
    expect(fullScreenImg.getAttribute("src")).toBe("img1.jpg");
  });
});
