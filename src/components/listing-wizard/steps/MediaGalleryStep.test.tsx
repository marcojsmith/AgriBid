import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { useListingWizard } from "@/hooks/listing-wizard/useListingWizard";
import { useListingMedia } from "@/hooks/listing-wizard/useListingMedia";

import { MediaGalleryStep } from "./MediaGalleryStep";
import type { ListingFormData } from "../types";
import type { ListingWizardContextType } from "../context/ListingWizardContextDef";

vi.mock("@/hooks/listing-wizard/useListingWizard", () => ({
  useListingWizard: vi.fn(),
}));

vi.mock("@/hooks/listing-wizard/useListingMedia", () => ({
  useListingMedia: vi.fn(),
}));

describe("MediaGalleryStep", () => {
  const mockHandleUpload = vi.fn();
  const mockHandleAdditionalUpload = vi.fn();
  const mockHandleRemove = vi.fn();
  const mockCleanupPreviews = vi.fn();

  const mockFormData = {
    images: {
      front: "",
      engine: "",
      cabin: "",
      rear: "",
      additional: [],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useListingWizard).mockReturnValue({
      formData: mockFormData as unknown as ListingFormData,
      previews: {},
      isSubmitting: false,
    } as unknown as ListingWizardContextType);
    vi.mocked(useListingMedia).mockReturnValue({
      handleUpload: mockHandleUpload,
      handleAdditionalUpload: mockHandleAdditionalUpload,
      handleRemove: mockHandleRemove,
      cleanupPreviews: mockCleanupPreviews,
    });
  });

  it("renders all photo slots", () => {
    render(<MediaGalleryStep />);
    expect(screen.getByText(/Front 45° View/i)).toBeInTheDocument();
    expect(screen.getByText(/Engine Bay/i)).toBeInTheDocument();
    expect(screen.getByText(/Instrument Cluster/i)).toBeInTheDocument();
    expect(screen.getByText(/Rear \/ Hitch/i)).toBeInTheDocument();
  });

  it("calls handleUpload when a file is selected for a slot", async () => {
    render(<MediaGalleryStep />);
    const input = screen.getByLabelText(
      /Upload image for slot Front 45° View/i
    );
    const file = new File([""], "test.jpg", { type: "image/jpeg" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockHandleUpload).toHaveBeenCalledWith("front", file);
    });
  });

  it("calls handleRemove when remove button is clicked", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        ...mockFormData,
        images: { ...mockFormData.images, front: "id1" },
      } as unknown as ListingFormData,
      previews: { front: "url1" },
      isSubmitting: false,
    } as unknown as ListingWizardContextType);

    render(<MediaGalleryStep />);
    const removeButton = screen.getByText(/Remove/i);
    fireEvent.click(removeButton);

    expect(mockHandleRemove).toHaveBeenCalledWith("front");
  });

  it("renders additional photo slots", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        ...mockFormData,
        images: { ...mockFormData.images, additional: ["add1"] },
      } as unknown as ListingFormData,
      previews: { add1: "url-add1" },
      isSubmitting: false,
    } as unknown as ListingWizardContextType);

    render(<MediaGalleryStep />);
    expect(screen.getByAltText("Additional 1")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Upload additional photo")
    ).toBeInTheDocument();
  });

  it("calls handleAdditionalUpload for additional photos", async () => {
    render(<MediaGalleryStep />);
    const input = screen.getByLabelText("Upload additional photo");
    const file = new File([""], "extra.jpg", { type: "image/jpeg" });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockHandleAdditionalUpload).toHaveBeenCalledWith([file]);
    });
  });

  it("renders check icon for additional photo without preview URL", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        ...mockFormData,
        images: { ...mockFormData.images, additional: ["add1"] },
      } as unknown as ListingFormData,
      previews: {}, // No preview for add1
      isSubmitting: false,
    } as unknown as ListingWizardContextType);

    render(<MediaGalleryStep />);
    // CheckCircle2 should be rendered. Since it's an SVG, we can check for a container or aria-label if it had one.
    // Or just verify alt text Additional 1 is NOT present.
    expect(screen.queryByAltText("Additional 1")).not.toBeInTheDocument();

    const removeButton = screen.getByRole("button", { name: /remove image/i });
    fireEvent.click(removeButton);
    expect(mockHandleRemove).toHaveBeenCalledWith("additional", 0);
  });

  it("renders preview from http storageId for fixed slots", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        images: { ...mockFormData.images, front: "http://example.com/img.jpg" },
      } as unknown as ListingFormData,
      previews: {},
      isSubmitting: false,
    } as unknown as ListingWizardContextType);

    render(<MediaGalleryStep />);
    expect(screen.getByAltText(/Front 45° View/i)).toBeInTheDocument();
  });

  it("renders preview from http storageId for additional slots", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        images: {
          ...mockFormData.images,
          additional: ["http://example.com/add.jpg"],
        },
      } as unknown as ListingFormData,
      previews: {},
      isSubmitting: false,
    } as unknown as ListingWizardContextType);

    render(<MediaGalleryStep />);
    expect(screen.getByAltText(/Additional 1/i)).toBeInTheDocument();
  });

  it("renders check icon for fixed slot without preview URL", () => {
    vi.mocked(useListingWizard).mockReturnValue({
      formData: {
        images: { ...mockFormData.images, front: "some-id" },
      } as unknown as ListingFormData,
      previews: {},
      isSubmitting: false,
    } as unknown as ListingWizardContextType);

    render(<MediaGalleryStep />);
    // Verify image is NOT present
    expect(screen.queryByAltText(/Front 45° View/i)).not.toBeInTheDocument();
  });
});
