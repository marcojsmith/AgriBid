import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery } from "convex/react";

import { useBranding } from "@/hooks/useBranding";
import type { BusinessInfo } from "@/hooks/useBranding";

import { Footer } from "./Footer";

vi.mock("@/hooks/useBranding", () => ({
  useBranding: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("convex/_generated/api", () => ({
  api: {
    legal: { getPublishedLegalSlugs: { name: "legal:getPublishedLegalSlugs" } },
  },
}));

/** Business details as `admin.getBusinessInfo` returns them. */
const businessInfo: BusinessInfo = {
  businessName: "AgriBid (Pty) Ltd",
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
  businessName: null,
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
    vi.mocked(useQuery).mockReturnValue([]);
  });

  const renderFooter = () =>
    render(
      <BrowserRouter>
        <Footer />
      </BrowserRouter>
    );

  it("renders the brand, company name and address from the branding context", () => {
    renderFooter();
    expect(screen.getByText("AgriBid (Pty) Ltd")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "1 Main Road, Centurion, ZA, 0157" })
    ).toHaveAttribute(
      "href",
      expect.stringContaining("1%20Main%20Road%2C%20Centurion")
    );
  });

  it("links the phone number and shows the WhatsApp logo link", () => {
    renderFooter();
    expect(
      screen.getByRole("link", { name: "+27-11-000-0000" })
    ).toHaveAttribute("href", "tel:+27110000000");
    expect(screen.getByRole("link", { name: "WhatsApp us" })).toHaveAttribute(
      "href",
      "https://wa.me/27825550100"
    );
  });

  it("shows registration and VAT numbers when set", () => {
    renderFooter();
    expect(screen.getByText("Reg. no. 2019/123456/07")).toBeInTheDocument();
    expect(screen.getByText("VAT no. 4123456789")).toBeInTheDocument();
  });

  it("hides every unset company detail", () => {
    vi.mocked(useBranding).mockReturnValue({
      appName: "AgriBid",
      businessInfo: emptyInfo,
    });
    renderFooter();
    expect(screen.queryByText(/Reg\. no\./)).toBeNull();
    expect(screen.queryByText(/VAT no\./)).toBeNull();
    expect(screen.queryByRole("link", { name: "WhatsApp us" })).toBeNull();
    expect(screen.queryByRole("link", { name: /\+27/ })).toBeNull();
    expect(screen.queryByText(/Main Road/)).toBeNull();
    expect(
      screen.getByText("AgriBid", { selector: "div" })
    ).toBeInTheDocument();
  });

  it("omits the company details while business info is unavailable", () => {
    vi.mocked(useBranding).mockReturnValue({
      appName: "AgriBid",
      businessInfo: undefined,
    });
    renderFooter();
    expect(screen.queryByText(/Reg\. no\./)).toBeNull();
    expect(screen.queryByRole("link", { name: "WhatsApp us" })).toBeNull();
  });

  it("falls back to AgriBid when branding is unavailable", () => {
    vi.mocked(useBranding).mockReturnValue(undefined);
    renderFooter();
    expect(
      screen.getByText("AgriBid", { selector: "div" })
    ).toBeInTheDocument();
  });

  it("links only to routes that exist", () => {
    renderFooter();
    const nav = screen.getByRole("navigation", { name: "Footer" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((l) => [l.textContent, l.getAttribute("href")])
    ).toEqual([
      ["Fees & rules", "/faq"],
      ["Sell equipment", "/sell"],
      ["Help", "/support"],
    ]);
  });

  it("shows the copyright", () => {
    renderFooter();
    expect(
      screen.getByText(`© ${String(new Date().getFullYear())} AgriBid`)
    ).toBeInTheDocument();
  });

  it("shows no legal links while none are published", () => {
    renderFooter();
    expect(
      within(screen.getByTestId("footer-legal")).queryAllByRole("link")
    ).toHaveLength(0);
  });

  it("hides the legal links while the published list is loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    renderFooter();
    expect(
      within(screen.getByTestId("footer-legal")).queryAllByRole("link")
    ).toHaveLength(0);
  });

  it("links only the published legal pages, in footer order", () => {
    vi.mocked(useQuery).mockReturnValue(["privacy", "terms"]);
    renderFooter();
    const links = within(screen.getByTestId("footer-legal")).getAllByRole(
      "link"
    );
    expect(links.map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["Terms", "/terms"],
      ["Privacy", "/privacy"],
    ]);
  });

  it("links all three pages when all are published", () => {
    vi.mocked(useQuery).mockReturnValue(["terms", "privacy", "paia"]);
    renderFooter();
    expect(
      within(screen.getByTestId("footer-legal")).getByRole("link", {
        name: "PAIA manual",
      })
    ).toHaveAttribute("href", "/paia");
  });
});
