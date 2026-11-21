import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";

import { useBranding } from "@/hooks/useBranding";
import type { BusinessInfo } from "@/hooks/useBranding";

import { Footer } from "./Footer";

vi.mock("@/hooks/useBranding", () => ({
  useBranding: vi.fn(),
}));

/** Business details as `admin.getBusinessInfo` returns them. */
const businessInfo: BusinessInfo = {
  businessName: "AgriBid",
  businessDescription: null,
  streetAddress: "1 Main Road",
  addressLocality: "Centurion",
  addressCountry: "ZA",
  postalCode: "0157",
  telephone: "+27-11-000-0000",
  email: null,
  website: null,
  logoUrl: null,
  sameAs: [],
  registrationNo: "2019/123456/07",
  vatNo: "4123456789",
  whatsapp: "+27 82 555 0100",
};

/** Every company field unset, as a fresh install has it. */
const emptyInfo: BusinessInfo = {
  ...businessInfo,
  streetAddress: null,
  addressLocality: null,
  addressCountry: null,
  postalCode: null,
  telephone: null,
  registrationNo: null,
  vatNo: null,
  whatsapp: null,
};

describe("Footer", () => {
  beforeEach(() => {
    vi.mocked(useBranding).mockReturnValue({
      appName: "AgriBid",
      businessInfo,
    });
  });

  const renderFooter = () =>
    render(
      <BrowserRouter>
        <Footer />
      </BrowserRouter>
    );

  it("renders the address and phone from the branding context", () => {
    renderFooter();

    const addressLink = screen.getByRole("link", {
      name: "1 Main Road, Centurion, ZA, 0157",
    });
    expect(addressLink).toHaveAttribute(
      "href",
      expect.stringContaining("1%20Main%20Road%2C%20Centurion")
    );

    const phoneLink = screen.getByRole("link", { name: "+27-11-000-0000" });
    expect(phoneLink).toHaveAttribute("href", "tel:+27110000000");
  });

  it("shows registration no., VAT no. and a WhatsApp link when set", () => {
    renderFooter();

    expect(screen.getByText("Reg. no. 2019/123456/07")).toBeInTheDocument();
    expect(screen.getByText("VAT no. 4123456789")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "WhatsApp +27 82 555 0100" })
    ).toHaveAttribute("href", "https://wa.me/27825550100");
  });

  it("hides each unset company row", () => {
    vi.mocked(useBranding).mockReturnValue({
      appName: "AgriBid",
      businessInfo: {
        ...businessInfo,
        registrationNo: null,
        vatNo: "  ",
        whatsapp: null,
        telephone: null,
      },
    });
    renderFooter();

    expect(screen.queryByText(/Reg\. no\./)).toBeNull();
    expect(screen.queryByText(/VAT no\./)).toBeNull();
    expect(screen.queryByText(/WhatsApp/)).toBeNull();
    expect(screen.queryByRole("link", { name: /000-0000/ })).toBeNull();
    // The address is still set, so the column and its heading stay.
    expect(
      screen.getByRole("heading", { name: "Company" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Main Road/ })).toBeInTheDocument();
  });

  it("removes the whole company column and heading when nothing is set", () => {
    vi.mocked(useBranding).mockReturnValue({
      appName: "AgriBid",
      businessInfo: emptyInfo,
    });
    renderFooter();

    expect(screen.queryByText("Company")).toBeNull();
    expect(screen.queryByText("Headquarters")).toBeNull();
  });

  it("never renders an empty heading", () => {
    vi.mocked(useBranding).mockReturnValue({
      appName: "AgriBid",
      businessInfo: emptyInfo,
    });
    renderFooter();

    for (const heading of screen.getAllByRole("heading")) {
      expect(heading.textContent?.trim()).not.toBe("");
      const list = heading.nextElementSibling;
      expect(list?.querySelectorAll("li").length).toBeGreaterThan(0);
    }
  });

  it("omits the company details while business info is unavailable", () => {
    vi.mocked(useBranding).mockReturnValue({
      appName: "AgriBid",
      businessInfo: undefined,
    });

    renderFooter();

    expect(screen.queryByText("Company")).toBeNull();
    expect(screen.queryByRole("link", { name: /Main Road/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /000-0000/ })).toBeNull();
  });

  it("falls back to AgriBid when branding is unavailable", () => {
    vi.mocked(useBranding).mockReturnValue(undefined);
    renderFooter();
    expect(screen.getByText("AgriBid")).toBeInTheDocument();
  });

  it("renders the brand, tagline and verification claim", () => {
    renderFooter();
    expect(screen.getByText("AgriBid")).toBeInTheDocument();
    expect(
      screen.getByText(/online auction floor for farm machinery/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText("Every seller FICA-verified before listing")
    ).toBeInTheDocument();
  });

  it("links only to routes that exist", () => {
    renderFooter();
    const nav = (name: string) => screen.getByRole("navigation", { name });
    expect(
      within(nav("Buy")).getByRole("link", { name: "Live auctions" })
    ).toHaveAttribute("href", "/auctions");
    expect(
      within(nav("Buy")).getByRole("link", { name: "Auction rules" })
    ).toHaveAttribute("href", "/faq");
    expect(
      within(nav("Sell and help")).getByRole("link", { name: "List equipment" })
    ).toHaveAttribute("href", "/sell");
    expect(
      within(nav("Sell and help")).getByRole("link", {
        name: "Contact support",
      })
    ).toHaveAttribute("href", "/support");
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toBe("#");
    }
  });

  it("shows the legal row as plain text: year, Terms, Privacy, PAIA", () => {
    renderFooter();
    const legal = screen.getByTestId("footer-legal");
    expect(legal).toHaveTextContent(
      `© ${String(new Date().getFullYear())} AgriBid`
    );
    for (const page of ["Terms", "Privacy", "PAIA manual"]) {
      expect(within(legal).getByText(page)).toBeInTheDocument();
    }
    // No routes exist for these yet, so they must not be dead links.
    expect(within(legal).queryAllByRole("link")).toHaveLength(0);
  });
});
