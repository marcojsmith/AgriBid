import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";

import { AuctionFormDialog } from "./AuctionFormDialog";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    auctions: {
      getAuctionById: { name: "auctions:getAuctionById" },
      mutations: {
        adminCrud: {
          createAuction: {
            name: "auctions/mutations/adminCrud:createAuction",
          },
          updateAuction: {
            name: "auctions/mutations/adminCrud:updateAuction",
          },
        },
      },
    },
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: mockApi,
}));

const mockUploadFiles = vi.fn();
const mockCleanupUploads = vi.fn();
const mockHandleFileChange = vi.fn();
// Stable reference across renders, matching real useState setter identity -
// an unstable mock here would retrigger the component's effect every render.
const mockSetFiles = vi.fn((f: File[]) => {
  mockFiles = f;
});
let mockFiles: File[] = [];

vi.mock("@/hooks/useFileUpload", () => ({
  useFileUpload: () => ({
    files: mockFiles,
    handleFileChange: mockHandleFileChange,
    uploadFiles: mockUploadFiles,
    isUploading: false,
    setFiles: mockSetFiles,
    cleanupUploads: mockCleanupUploads,
  }),
}));

describe("AuctionFormDialog", () => {
  const mockCreate = vi.fn();
  const mockUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFiles = [];
    (useQuery as Mock).mockReturnValue(null);
    (useMutation as Mock).mockImplementation((apiPath) => {
      if (apiPath === mockApi.auctions.mutations.adminCrud.createAuction)
        return mockCreate;
      if (apiPath === mockApi.auctions.mutations.adminCrud.updateAuction)
        return mockUpdate;
      return vi.fn();
    });
  });

  it("rejects submission without a title", async () => {
    render(<AuctionFormDialog open auctionId={null} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Title is required");
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects an end time before the start time", async () => {
    render(<AuctionFormDialog open auctionId={null} onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Spring Sale" },
    });
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "2026-06-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "2026-05-01T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "End time must be after start time"
      );
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a new auction event with valid fields", async () => {
    mockCreate.mockResolvedValue("new-id");
    const onOpenChange = vi.fn();
    render(
      <AuctionFormDialog open auctionId={null} onOpenChange={onOpenChange} />
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Spring Sale" },
    });
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "2026-05-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "2026-06-01T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Spring Sale" })
      );
      expect(toast.success).toHaveBeenCalledWith("Auction created");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("updates an existing auction event when editingId is set", async () => {
    (useQuery as Mock).mockReturnValue({
      title: "Existing Sale",
      description: "desc",
      bannerImageUrl: undefined,
      startTime: new Date("2026-05-01T10:00").getTime(),
      endTime: new Date("2026-06-01T10:00").getTime(),
      defaultBuyerPremiumPct: 0.05,
      defaultSellerCommissionPct: undefined,
    });
    mockUpdate.mockResolvedValue({ success: true });
    const onOpenChange = vi.fn();

    render(
      <AuctionFormDialog
        open
        auctionId={"auc1" as never}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getByDisplayValue("Existing Sale")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ auctionId: "auc1", title: "Existing Sale" })
      );
      expect(toast.success).toHaveBeenCalledWith("Auction updated");
    });
  });

  it("shows an error toast and cleans up an uploaded banner if saving fails", async () => {
    mockUploadFiles.mockResolvedValue(["storage-1"]);
    mockCreate.mockRejectedValue(new Error("Save failed"));

    render(<AuctionFormDialog open auctionId={null} onOpenChange={vi.fn()} />);

    // Set after mount: the component's own create-mode effect clears the
    // file list on open, same as a user picking a banner afterwards would.
    mockFiles = [new File(["x"], "banner.png", { type: "image/png" })];

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Spring Sale" },
    });
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "2026-05-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "2026-06-01T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Save failed");
      expect(mockCleanupUploads).toHaveBeenCalledWith(["storage-1"]);
    });
  });

  it("requires start and end time when the title is set", async () => {
    render(<AuctionFormDialog open auctionId={null} onOpenChange={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Spring Sale" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Start and end time are required"
      );
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("uploads a banner and passes percentage defaults on create", async () => {
    mockUploadFiles.mockResolvedValue(["storage-1"]);
    mockCreate.mockResolvedValue("new-id");

    render(<AuctionFormDialog open auctionId={null} onOpenChange={vi.fn()} />);

    mockFiles = [new File(["x"], "banner.png", { type: "image/png" })];

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Spring Sale" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "A sale" },
    });
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "2026-05-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "2026-06-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText("Default Buyer Premium (%)"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Default Seller Commission (%)"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Spring Sale",
          description: "A sale",
          bannerImage: "storage-1",
          defaultBuyerPremiumPct: 0.05,
          defaultSellerCommissionPct: 0.03,
        })
      );
    });
  });

  it("aborts saving when the banner upload fails", async () => {
    mockUploadFiles.mockResolvedValue(null);

    render(<AuctionFormDialog open auctionId={null} onOpenChange={vi.fn()} />);

    mockFiles = [new File(["x"], "banner.png", { type: "image/png" })];

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Spring Sale" },
    });
    fireEvent.change(screen.getByLabelText("Start"), {
      target: { value: "2026-05-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText("End"), {
      target: { value: "2026-06-01T10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockUploadFiles).toHaveBeenCalled();
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("shows the existing banner when editing", () => {
    (useQuery as Mock).mockReturnValue({
      title: "Existing Sale",
      description: "desc",
      bannerImageUrl: "https://cdn/banner.jpg",
      startTime: new Date("2026-05-01T10:00").getTime(),
      endTime: new Date("2026-06-01T10:00").getTime(),
      defaultBuyerPremiumPct: undefined,
      defaultSellerCommissionPct: undefined,
    });

    render(
      <AuctionFormDialog
        open
        auctionId={"auc1" as never}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByAltText("Current banner")).toHaveAttribute(
      "src",
      "https://cdn/banner.jpg"
    );
  });
});
