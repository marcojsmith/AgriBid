import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { useQuery } from "convex/react";

import LegalPage from "./LegalPage";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.mock("convex/_generated/api", () => ({
  api: { legal: { getLegalPage: { name: "legal:getLegalPage" } } },
}));

const renderPage = (slug: "terms" | "privacy" | "paia" = "terms") =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <LegalPage slug={slug} />
      </MemoryRouter>
    </HelmetProvider>
  );

describe("LegalPage", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
  });

  it("shows a loading skeleton while the query loads", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    renderPage();
    expect(
      screen.getByRole("status", { name: "Loading page" })
    ).toBeInTheDocument();
  });

  it("renders the title, SAST last-updated date and markdown body when published", async () => {
    vi.mocked(useQuery).mockReturnValue({
      title: "Terms and conditions",
      body: "## 1. About\n\nHello **world**.",
      publishedAt: Date.UTC(2026, 10, 1),
      updatedAt: Date.UTC(2026, 10, 21, 9, 0),
    });
    renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "Terms and conditions" })
    ).toBeInTheDocument();
    expect(screen.getByText("Last updated 21 Nov 2026")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "1. About" })
    ).toBeInTheDocument();
    expect(screen.getByText("world").tagName).toBe("STRONG");
    expect(screen.queryByText(/not published yet/i)).toBeNull();
    await waitFor(() => {
      expect(document.title).toBe("Terms and conditions | AgriBid");
    });
  });

  it("queries by the slug it is given", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    renderPage("paia");
    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(expect.anything(), {
      slug: "paia",
    });
  });

  it("shows the not-published notice, a home link and noindex when null", async () => {
    vi.mocked(useQuery).mockReturnValue(null);
    renderPage("privacy");
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy policy" })
    ).toBeInTheDocument();
    expect(
      screen.getByText("This page is not published yet.")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute(
      "href",
      "/"
    );
    // Only the title, the notice and the home link: no stored text at all.
    expect(document.body.textContent).toBe(
      "Privacy policyThis page is not published yet.Back to home"
    );
    await waitFor(() => {
      expect(
        document.querySelector('meta[name="robots"]')?.getAttribute("content")
      ).toBe("noindex");
    });
  });
});
