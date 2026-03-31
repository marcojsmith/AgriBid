import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { useQuery, useMutation } from "convex/react";
import { toast } from "sonner";
import type { Id } from "convex/_generated/dataModel";

import AdminFAQ from "./AdminFAQ";

type FaqItem = {
  _id: Id<"faqItems">;
  _creationTime: number;
  question: string;
  answer: string;
  order: number;
  isPublished: boolean;
};

let mockFaqItems: FaqItem[] | undefined;
const mockCreateFaqItem = vi.fn();
const mockUpdateFaqItem = vi.fn();
const mockDeleteFaqItem = vi.fn();
const mockReorderFaqItems = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => mockFaqItems),
  useMutation: vi.fn(),
}));

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    admin: {
      getAllFaqItems: "admin:getAllFaqItems",
      createFaqItem: "admin:createFaqItem",
      updateFaqItem: "admin:updateFaqItem",
      deleteFaqItem: "admin:deleteFaqItem",
      reorderFaqItems: "admin:reorderFaqItems",
    },
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: mockApi,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="admin-layout">{children}</div>
  ),
}));

const sampleFaqs: FaqItem[] = [
  {
    _id: "faq1" as Id<"faqItems">,
    _creationTime: Date.now(),
    question: "How do I register?",
    answer: "Create a free account.",
    order: 0,
    isPublished: true,
  },
  {
    _id: "faq2" as Id<"faqItems">,
    _creationTime: Date.now(),
    question: "What is KYC?",
    answer: "Know Your Customer.",
    order: 1,
    isPublished: false,
  },
];

describe("AdminFAQ", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFaqItems = undefined;
    (useQuery as Mock).mockImplementation(() => mockFaqItems);
    (useMutation as Mock).mockImplementation(
      (apiRef: { _path?: string } | string) => {
        const ref = typeof apiRef === "string" ? apiRef : (apiRef as string);
        if (ref === mockApi.admin.createFaqItem) return mockCreateFaqItem;
        if (ref === mockApi.admin.updateFaqItem) return mockUpdateFaqItem;
        if (ref === mockApi.admin.deleteFaqItem) return mockDeleteFaqItem;
        if (ref === mockApi.admin.reorderFaqItems) return mockReorderFaqItems;
        return vi.fn();
      }
    );
  });

  it("renders loading state when faqItems is undefined", () => {
    render(<AdminFAQ />);
    expect(screen.getByTestId("admin-layout")).toBeInTheDocument();
    expect(
      screen.queryByRole("status") ?? document.querySelector(".animate-spin")
    ).toBeInTheDocument();
  });

  it("renders empty state when there are no FAQ items", () => {
    mockFaqItems = [];
    (useQuery as Mock).mockReturnValue([]);
    render(<AdminFAQ />);
    expect(screen.getByText(/no faq items yet/i)).toBeInTheDocument();
    expect(screen.getByText(/create your first faq item/i)).toBeInTheDocument();
  });

  it("renders FAQ items in a table", () => {
    mockFaqItems = sampleFaqs;
    (useQuery as Mock).mockReturnValue(sampleFaqs);
    render(<AdminFAQ />);
    expect(screen.getByText("How do I register?")).toBeInTheDocument();
    expect(screen.getByText("What is KYC?")).toBeInTheDocument();
  });

  it("shows Published badge for published items and Draft for unpublished", () => {
    mockFaqItems = sampleFaqs;
    (useQuery as Mock).mockReturnValue(sampleFaqs);
    render(<AdminFAQ />);
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders New FAQ Item button", () => {
    mockFaqItems = [];
    (useQuery as Mock).mockReturnValue([]);
    render(<AdminFAQ />);
    expect(
      screen.getByRole("button", { name: /new faq item/i })
    ).toBeInTheDocument();
  });

  it("opens create dialog when New FAQ Item is clicked", () => {
    mockFaqItems = [];
    (useQuery as Mock).mockReturnValue([]);
    render(<AdminFAQ />);
    fireEvent.click(screen.getByRole("button", { name: /new faq item/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/question/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/answer/i)).toBeInTheDocument();
  });

  it("shows error toast when saving with empty question", async () => {
    mockFaqItems = [];
    (useQuery as Mock).mockReturnValue([]);
    render(<AdminFAQ />);
    fireEvent.click(screen.getByRole("button", { name: /new faq item/i }));

    // Leave question blank, fill answer
    fireEvent.change(screen.getByLabelText(/answer/i), {
      target: { value: "Some answer" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Question is required");
    });
  });

  it("calls createFaqItem and shows success toast on valid save", async () => {
    mockFaqItems = [];
    (useQuery as Mock).mockReturnValue([]);
    mockCreateFaqItem.mockResolvedValue(null);
    render(<AdminFAQ />);

    fireEvent.click(screen.getByRole("button", { name: /new faq item/i }));
    fireEvent.change(screen.getByLabelText(/question/i), {
      target: { value: "New Question?" },
    });
    fireEvent.change(screen.getByLabelText(/answer/i), {
      target: { value: "New Answer." },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(mockCreateFaqItem).toHaveBeenCalledWith(
        expect.objectContaining({
          question: "New Question?",
          answer: "New Answer.",
        })
      );
      expect(toast.success).toHaveBeenCalledWith("FAQ item created");
    });
  });

  it("calls updateFaqItem when toggling published status", async () => {
    mockFaqItems = sampleFaqs;
    (useQuery as Mock).mockReturnValue(sampleFaqs);
    mockUpdateFaqItem.mockResolvedValue(null);
    render(<AdminFAQ />);

    // Click the Published badge to toggle it
    fireEvent.click(screen.getByText("Published"));

    await waitFor(() => {
      expect(mockUpdateFaqItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: "faq1", isPublished: false })
      );
    });
  });

  it("opens edit dialog with existing data when edit button clicked", () => {
    mockFaqItems = sampleFaqs;
    (useQuery as Mock).mockReturnValue(sampleFaqs);
    render(<AdminFAQ />);

    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[0]);

    expect(screen.getByText("Edit FAQ Item")).toBeInTheDocument();
    expect(screen.getByDisplayValue("How do I register?")).toBeInTheDocument();
  });

  it("move up button is disabled for first item", () => {
    mockFaqItems = sampleFaqs;
    (useQuery as Mock).mockReturnValue(sampleFaqs);
    render(<AdminFAQ />);

    const moveUpButtons = screen.getAllByRole("button", { name: /move up/i });
    expect(moveUpButtons[0]).toBeDisabled();
  });

  it("move down button is disabled for last item", () => {
    mockFaqItems = sampleFaqs;
    (useQuery as Mock).mockReturnValue(sampleFaqs);
    render(<AdminFAQ />);

    const moveDownButtons = screen.getAllByRole("button", {
      name: /move down/i,
    });
    expect(moveDownButtons[moveDownButtons.length - 1]).toBeDisabled();
  });

  it("calls reorderFaqItems when move up is clicked", async () => {
    mockFaqItems = sampleFaqs;
    (useQuery as Mock).mockReturnValue(sampleFaqs);
    mockReorderFaqItems.mockResolvedValue(null);
    render(<AdminFAQ />);

    const moveDownButtons = screen.getAllByRole("button", {
      name: /move down/i,
    });
    fireEvent.click(moveDownButtons[0]);

    await waitFor(() => {
      expect(mockReorderFaqItems).toHaveBeenCalled();
    });
  });

  it("move up button enabled for non-first item", () => {
    const threeFaqs = [
      sampleFaqs[0],
      sampleFaqs[1],
      { ...sampleFaqs[0], _id: "faq3" as Id<"faqItems"> },
    ];
    mockFaqItems = threeFaqs;
    (useQuery as Mock).mockReturnValue(threeFaqs);
    render(<AdminFAQ />);

    const moveUpButtons = screen.getAllByRole("button", { name: /move up/i });
    expect(moveUpButtons[1]).not.toBeDisabled();
  });

  it("move down button enabled for non-last item", () => {
    const threeFaqs = [
      sampleFaqs[0],
      sampleFaqs[1],
      { ...sampleFaqs[0], _id: "faq3" as Id<"faqItems"> },
    ];
    mockFaqItems = threeFaqs;
    (useQuery as Mock).mockReturnValue(threeFaqs);
    render(<AdminFAQ />);

    const moveDownButtons = screen.getAllByRole("button", {
      name: /move down/i,
    });
    expect(moveDownButtons[1]).not.toBeDisabled();
  });

  it("shows error toast when create fails", async () => {
    mockFaqItems = [];
    (useQuery as Mock).mockReturnValue([]);
    mockCreateFaqItem.mockRejectedValue(new Error("Database error"));
    render(<AdminFAQ />);

    fireEvent.click(screen.getByRole("button", { name: /new faq item/i }));
    fireEvent.change(screen.getByLabelText(/question/i), {
      target: { value: "Test Question" },
    });
    fireEvent.change(screen.getByLabelText(/answer/i), {
      target: { value: "Test Answer" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Database error");
    });
  });

  it("shows error toast when toggle publish fails", async () => {
    mockFaqItems = sampleFaqs;
    (useQuery as Mock).mockReturnValue(sampleFaqs);
    mockUpdateFaqItem.mockRejectedValue(new Error("Update failed"));
    render(<AdminFAQ />);

    fireEvent.click(screen.getByText("Published"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Update failed");
    });
  });

  it("shows error toast when delete fails", async () => {
    mockFaqItems = sampleFaqs;
    (useQuery as Mock).mockReturnValue(sampleFaqs);
    mockDeleteFaqItem.mockRejectedValue(new Error("Delete failed"));
    render(<AdminFAQ />);

    fireEvent.click(screen.getAllByRole("button", { name: /delete/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Delete failed");
    });
  });

  it("shows error toast when reorder fails", async () => {
    mockFaqItems = sampleFaqs;
    (useQuery as Mock).mockReturnValue(sampleFaqs);
    mockReorderFaqItems.mockRejectedValue(new Error("Reorder failed"));
    render(<AdminFAQ />);

    const moveDownButtons = screen.getAllByRole("button", {
      name: /move down/i,
    });
    fireEvent.click(moveDownButtons[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Reorder failed");
    });
  });

  it("shows error toast when save with empty answer", async () => {
    mockFaqItems = [];
    (useQuery as Mock).mockReturnValue([]);
    render(<AdminFAQ />);

    fireEvent.click(screen.getByRole("button", { name: /new faq item/i }));
    fireEvent.change(screen.getByLabelText(/question/i), {
      target: { value: "Test Question" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Answer is required");
    });
  });
});
