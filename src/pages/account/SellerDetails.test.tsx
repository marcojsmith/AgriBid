import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mutationMock,
  resetConvexState,
  setQuery,
} from "@/pages/register/testing";

import SellerDetails from "./SellerDetails";

const m = vi.hoisted(
  (): { user: unknown; toast: ReturnType<typeof vi.fn> } => ({
    user: undefined,
    toast: vi.fn(),
  })
);

vi.mock("convex/react", async () => {
  const t = await import("@/pages/register/testing");
  return { useQuery: t.mockUseQuery, useMutation: t.mockUseMutation };
});
vi.mock("@/hooks/useUserProfile", () => ({ useUserProfile: () => m.user }));
vi.mock("@/components/ds/showToast", () => ({ showToast: m.toast }));

/**
 * Renders the page with saved values.
 *
 * @param bio - The saved About state
 */
function renderPage(
  bio: Record<string, string> | null = { bio: "We farm maize." }
) {
  m.user = {
    profile: {
      companyName: "Naidoo Landbou",
      location: "Malmesbury",
      vatRegistered: false,
      sellerType: "farming_business",
    },
  };
  setQuery(api.lotPayments.getMyCollectionAddress, "Farm gate 2");
  setQuery(api.users.getMyBio, bio);
  render(
    <HelmetProvider>
      <MemoryRouter>
        <SellerDetails />
      </MemoryRouter>
    </HelmetProvider>
  );
}

beforeEach(() => {
  resetConvexState();
  vi.clearAllMocks();
});

describe("SellerDetails", () => {
  it("shows a skeleton while loading", () => {
    m.user = undefined;
    render(
      <HelmetProvider>
        <MemoryRouter>
          <SellerDetails />
        </MemoryRouter>
      </HelmetProvider>
    );
    expect(
      screen.getByRole("status", { name: "Loading seller details" })
    ).toBeInTheDocument();
  });

  it("fills the form and the collection address helper", () => {
    renderPage();
    expect(screen.getByLabelText("Business name")).toHaveValue(
      "Naidoo Landbou"
    );
    expect(screen.getByLabelText("Town or area")).toHaveValue("Malmesbury");
    expect(screen.getByLabelText("Collection address")).toHaveValue(
      "Farm gate 2"
    );
    expect(screen.getByLabelText("About")).toHaveValue("We farm maize.");
    expect(
      screen.getByText("Only shown to a buyer after we confirm their payment.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: "Farming business" })
    ).toHaveAttribute("aria-checked", "true");
  });

  it("saves the profile without bio when the text did not change", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Business name"), {
      target: { value: "Naidoo Boerdery" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "VAT registered" }));
    fireEvent.click(screen.getByRole("radio", { name: "Dealer" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(m.toast).toHaveBeenCalledWith("Seller details saved.");
    });
    expect(mutationMock(api.users.updateMyProfile)).toHaveBeenCalledWith({
      companyName: "Naidoo Boerdery",
      location: "Malmesbury",
      vatRegistered: true,
      sellerType: "dealer",
    });
    expect(
      mutationMock(api.lotPayments.updateMyCollectionAddress)
    ).not.toHaveBeenCalled();
  });

  it("sends the bio and the address only when they changed", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("About"), {
      target: { value: "We farm maize and wheat." },
    });
    fireEvent.change(screen.getByLabelText("Collection address"), {
      target: { value: "Farm gate 3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(m.toast).toHaveBeenCalledWith(
        "Saved. Your About text is waiting for approval."
      );
    });
    expect(mutationMock(api.users.updateMyProfile)).toHaveBeenCalledWith(
      expect.objectContaining({ bio: "We farm maize and wheat." })
    );
    expect(
      mutationMock(api.lotPayments.updateMyCollectionAddress)
    ).toHaveBeenCalledWith({ address: "Farm gate 3" });
  });

  it("needs no approval to clear the About text", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("About"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(m.toast).toHaveBeenCalledWith("Seller details saved.");
    });
  });

  it("says when only the collection address failed", async () => {
    mutationMock(api.lotPayments.updateMyCollectionAddress).mockRejectedValue(
      new Error("Too long")
    );
    renderPage();
    fireEvent.change(screen.getByLabelText("Collection address"), {
      target: { value: "Farm gate 9" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText(
        /Your other details were saved, but not the collection address/
      )
    ).toBeInTheDocument();
  });

  it("shows a save error", async () => {
    mutationMock(api.users.updateMyProfile).mockRejectedValue(
      new Error("Too long")
    );
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Too long")).toBeInTheDocument();
  });

  it("shows a pending edit and withdraws it", async () => {
    renderPage({
      bio: "We farm maize.",
      bioPending: "New text",
      bioStatus: "pending",
    });
    expect(screen.getByText("Waiting for approval")).toBeInTheDocument();
    expect(screen.getByLabelText("About")).toHaveValue("New text");
    fireEvent.click(screen.getByRole("button", { name: "Withdraw edit" }));
    await waitFor(() => {
      expect(mutationMock(api.users.updateMyProfile)).toHaveBeenCalledWith({
        bio: "We farm maize.",
        withdrawPendingBio: true,
      });
    });
    expect(screen.getByLabelText("About")).toHaveValue("We farm maize.");
  });

  it("reports a failed withdraw", async () => {
    mutationMock(api.users.updateMyProfile).mockRejectedValue(new Error("no"));
    renderPage({ bioPending: "x", bioStatus: "pending" });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw edit" }));
    await waitFor(() => {
      expect(m.toast).toHaveBeenCalledWith("no", "error");
    });
  });

  it("shows the reason when the text was not approved", () => {
    renderPage({
      bio: "Old",
      bioStatus: "rejected",
      bioRejectionReason: "Contains a phone number",
    });
    expect(
      screen.getByText(/Not approved: Contains a phone number/)
    ).toBeInTheDocument();
  });

  it("starts empty with no saved About text", () => {
    renderPage(null);
    expect(screen.getByLabelText("About")).toHaveValue("");
  });
});
