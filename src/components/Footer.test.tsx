import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
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

  it("renders the headquarters address and phone from the branding context", () => {
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
    expect(screen.getByText("Company")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Main Road/ })).toBeInTheDocument();
  });

  it("removes the whole company column and heading when nothing is set", () => {
    vi.mocked(useBranding).mockReturnValue({
      appName: "AgriBid",
      businessInfo: {
        ...businessInfo,
        streetAddress: null,
        addressLocality: null,
        addressCountry: null,
        postalCode: null,
        telephone: null,
        registrationNo: null,
        vatNo: null,
        whatsapp: null,
      },
    });
    renderFooter();

    expect(screen.queryByText("Company")).toBeNull();
    expect(screen.queryByText("Headquarters")).toBeNull();
  });

  it("omits the contact details while business info is unavailable", () => {
    vi.mocked(useBranding).mockReturnValue({
      appName: "AgriBid",
      businessInfo: undefined,
    });

    renderFooter();

    expect(
      screen.queryByRole("link", { name: "Headquarters" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Main Road/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /000-0000/ })).toBeNull();
  });

  it("renders the brand name and copyright", () => {
    renderFooter();
    expect(screen.getAllByText(/AGRIBID/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });

  it("contains the mission statement", () => {
    renderFooter();
    expect(screen.getByText(/built for farmers/i)).toBeInTheDocument();
  });

  it("renders all required navigation sections and links", () => {
    renderFooter();
    expect(screen.getByText(/How it Works/i)).toBeInTheDocument();
    expect(screen.getByText(/Safety & Trust/i)).toBeInTheDocument();
    expect(screen.getByText(/Terms of Service/i)).toBeInTheDocument();
    expect(screen.getByText(/Help Center/i)).toBeInTheDocument();
  });

  it("links 'How it Works' to the /faq page", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /how it works/i });
    expect(link).toHaveAttribute("href", "/faq");
  });

  it("tightens vertical padding, column gaps and the bottom bar on phones", () => {
    renderFooter();
    const footer = screen.getByRole("contentinfo");
    const inner = footer.firstElementChild;
    const grid = inner?.firstElementChild;
    const bottomBar = inner?.lastElementChild;

    // The footer used a flat `py-16`, which made it ~950px tall on a 375px
    // phone. Phones/tablets get a compact rhythm; desktop keeps today's values.
    expect(footer).toHaveClass("py-8", "md:py-16");
    expect(grid).toHaveClass("gap-8", "md:gap-10", "lg:gap-12");
    expect(bottomBar).toHaveClass("mt-8", "pt-6", "md:mt-16", "md:pt-8");
  });

  it("puts Platform and Support side by side on phones and keeps md+ layout unchanged", () => {
    renderFooter();
    const grid =
      screen.getByRole("contentinfo").firstElementChild?.firstElementChild;
    const brandColumn = screen.getAllByText(/AGRIBID/i)[0].parentElement;
    const platformColumn = screen.getByText("Platform").parentElement;
    const supportColumn = screen.getByText("Support").parentElement;
    const headquartersColumn = screen.getByText("Company").parentElement;

    // Four stacked columns left the footer ~737px tall on a 375px phone.
    // Mobile is a two-column grid: Platform and Support share a row while the
    // brand block and Headquarters span the full width.
    expect(grid).toHaveClass("grid-cols-2", "lg:grid-cols-4");
    expect(brandColumn).toHaveClass("col-span-2", "md:col-span-1");
    expect(headquartersColumn).toHaveClass("col-span-2", "md:col-span-1");
    // The two link columns keep a single track on every breakpoint.
    expect(platformColumn?.className).not.toContain("col-span-2");
    expect(supportColumn?.className).not.toContain("col-span-2");

    // Source order is untouched, so md/lg still read brand → links → contact.
    const columns = Array.from(grid?.children ?? []) as HTMLElement[];
    expect(columns[0]).toBe(brandColumn);
    expect(columns[1]).toBe(platformColumn);
    expect(columns[2]).toBe(supportColumn);
    expect(columns[3]).toBe(headquartersColumn);
  });
});
