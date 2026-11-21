import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

import AdminLegal from "./AdminLegal";

vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({
    children,
    title,
  }: {
    children: ReactNode;
    title: string;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    admin: {
      legal: {
        adminGetLegalPages: { name: "adminGetLegalPages" },
        updateLegalPage: { name: "updateLegalPage" },
        setLegalPagePublished: { name: "setLegalPagePublished" },
        createMissingLegalPageDrafts: { name: "createMissingLegalPageDrafts" },
      },
    },
  },
}));

/**
 * Replaces the value of a controlled input.
 *
 * @param el - The input or textarea.
 * @param value - The new value.
 */
const setValue = (el: HTMLElement, value: string) => {
  fireEvent.change(el, { target: { value } });
};

const updateLegalPage = vi.fn();
const setLegalPagePublished = vi.fn();
const createMissingLegalPageDrafts = vi.fn();

const draft = (slug: "terms" | "privacy" | "paia", title: string) => ({
  slug,
  title,
  body: `## Starter for ${slug}\n\n[Describe it]`,
  isPublished: false,
  publishedAt: undefined,
  updatedAt: Date.UTC(2026, 10, 21, 9, 0),
  updatedBy: "SYSTEM",
  updatedByName: "System (starter template)",
});

const allDrafts = () => [
  draft("terms", "Terms and conditions"),
  draft("privacy", "Privacy policy"),
  draft("paia", "PAIA manual"),
];

describe("AdminLegal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateLegalPage.mockResolvedValue(null);
    setLegalPagePublished.mockResolvedValue(null);
    createMissingLegalPageDrafts.mockResolvedValue([]);
    vi.mocked(useMutation).mockImplementation(((ref: { name: string }) => {
      if (ref.name === "updateLegalPage") return updateLegalPage;
      if (ref.name === "setLegalPagePublished") return setLegalPagePublished;
      return createMissingLegalPageDrafts;
    }) as unknown as typeof useMutation);
    vi.mocked(useQuery).mockReturnValue(allDrafts());
  });

  it("shows a loading indicator while pages load", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<AdminLegal />);
    expect(
      screen.queryByRole("tab", { name: /Terms/ })
    ).not.toBeInTheDocument();
  });

  it("shows three tabs, the draft banner and who last updated the page", () => {
    render(<AdminLegal />);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByText("Draft, needs legal review")).toBeInTheDocument();
    expect(
      screen.getByText(/by System \(starter template\)/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Terms and conditions");
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("renders a live markdown preview that follows edits and escapes HTML", () => {
    render(<AdminLegal />);
    const preview = screen.getByTestId("legal-preview-terms");
    expect(
      within(preview).getByRole("heading", { name: "Starter for terms" })
    ).toBeInTheDocument();

    const body = screen.getByLabelText("Body (markdown)");
    setValue(body, "Plain **bold** <script>alert(1)</script>");
    expect(within(preview).getByText("bold").tagName).toBe("STRONG");
    expect(preview.querySelector("script")).toBeNull();
  });

  it("saves an unpublished page without a confirm dialog", async () => {
    render(<AdminLegal />);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    const title = screen.getByLabelText("Title");
    setValue(title, "Terms of use");
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => {
      expect(updateLegalPage).toHaveBeenCalledWith({
        slug: "terms",
        title: "Terms of use",
        body: "## Starter for terms\n\n[Describe it]",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Legal page saved");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("disables Save for an empty title and blocks Publish while there are unsaved edits", () => {
    render(<AdminLegal />);
    setValue(screen.getByLabelText("Title"), "");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(
      screen.getByText("Save your changes before publishing.")
    ).toBeInTheDocument();
  });

  it("asks for confirmation before publishing, and cancel does nothing", async () => {
    render(<AdminLegal />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("Publish Terms and conditions?")
    ).toBeInTheDocument();
    expect(setLegalPagePublished).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(setLegalPagePublished).not.toHaveBeenCalled();
  });

  it("publishes after confirming", async () => {
    render(<AdminLegal />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish" }));
    await waitFor(() => {
      expect(setLegalPagePublished).toHaveBeenCalledWith({
        slug: "terms",
        isPublished: true,
      });
    });
    expect(toast.success).toHaveBeenCalledWith("Page published");
  });

  it("shows server errors as a toast when publishing fails", async () => {
    setLegalPagePublished.mockRejectedValue(new Error("Not allowed"));
    render(<AdminLegal />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish" }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("warns that a published page is live, confirms Save, and unpublishes without a dialog", async () => {
    vi.mocked(useQuery).mockReturnValue([
      {
        ...draft("terms", "Terms and conditions"),
        isPublished: true,
        publishedAt: Date.UTC(2026, 10, 20),
        updatedBy: "u1",
        updatedByName: "Ada Admin",
      },
      draft("privacy", "Privacy policy"),
      draft("paia", "PAIA manual"),
    ]);
    render(<AdminLegal />);

    expect(screen.queryByText("Draft, needs legal review")).toBeNull();
    expect(
      screen.getByText(/Saved changes go live immediately/)
    ).toBeInTheDocument();
    expect(screen.getByText(/by Ada Admin/)).toBeInTheDocument();

    const title = screen.getByLabelText("Title");
    setValue(title, "Terms and conditions v2");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/goes live immediately/)
    ).toBeInTheDocument();
    expect(updateLegalPage).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(updateLegalPage).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "terms",
          title: "Terms and conditions v2",
        })
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    await waitFor(() => {
      expect(setLegalPagePublished).toHaveBeenCalledWith({
        slug: "terms",
        isPublished: false,
      });
    });
  });

  it("switches tabs to edit another page", async () => {
    render(<AdminLegal />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Privacy/ }), {
      button: 0,
    });
    expect(await screen.findByLabelText("Title")).toHaveValue("Privacy policy");
  });

  it("offers to create starter drafts when pages are missing", async () => {
    vi.mocked(useQuery).mockReturnValue([
      draft("terms", "Terms and conditions"),
    ]);
    render(<AdminLegal />);
    fireEvent.click(
      screen.getByRole("button", { name: "Create starter drafts" })
    );
    await waitFor(() => {
      expect(createMissingLegalPageDrafts).toHaveBeenCalledWith({});
    });
    expect(toast.success).toHaveBeenCalledWith("Starter drafts created");

    fireEvent.mouseDown(screen.getByRole("tab", { name: /Privacy/ }), {
      button: 0,
    });
    expect(
      await screen.findByText(/has not been created yet/)
    ).toBeInTheDocument();
  });
});
