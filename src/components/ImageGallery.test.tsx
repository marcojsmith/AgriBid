import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { ImageGallery } from "./ImageGallery";

interface DialogProps {
  children?: React.ReactNode;
  open?: boolean;
}

// Mock Dialog to avoid Portal issues
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: DialogProps) => (
    <div data-testid="dialog" data-open={open}>
      {children}
    </div>
  ),
  DialogContent: ({ children }: DialogProps) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogTrigger: ({ children }: DialogProps) => (
    <div data-testid="dialog-trigger">{children}</div>
  ),
  DialogTitle: ({ children }: DialogProps) => <div>{children}</div>,
}));

describe("ImageGallery", () => {
  const mockImages = ["url1.jpg", "url2.jpg"];
  const mockTitle = "Test Item";

  it("renders placeholder when no images provided", () => {
    render(<ImageGallery images={[]} title={mockTitle} />);
    expect(screen.getByText(/Image Pending/i)).toBeInTheDocument();
    expect(screen.getByText("🚜")).toBeInTheDocument();
  });

  it("renders main image when images are provided", () => {
    render(<ImageGallery images={mockImages} title={mockTitle} />);
    const mainImg = screen.getByAltText(`${mockTitle} - Main`);
    expect(mainImg).toHaveAttribute("src", "url1.jpg");
  });

  it("renders thumbnails when multiple images provided", () => {
    render(<ImageGallery images={mockImages} title={mockTitle} />);
    expect(screen.getByAltText(`${mockTitle} thumbnail 1`)).toBeInTheDocument();
    expect(screen.getByAltText(`${mockTitle} thumbnail 2`)).toBeInTheDocument();
  });

  it("changes main image when thumbnail is clicked", () => {
    render(<ImageGallery images={mockImages} title={mockTitle} />);
    const thumbnail2 = screen.getByLabelText("View image 2");
    fireEvent.click(thumbnail2);

    const mainImg = screen.getByAltText(`${mockTitle} - Main`);
    expect(mainImg).toHaveAttribute("src", "url2.jpg");
  });
});
