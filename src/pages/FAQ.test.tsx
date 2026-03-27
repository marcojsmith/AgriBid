import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, type Mock } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { useQuery } from "convex/react";

import FAQ from "./FAQ";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    faq: { getPublishedFaqs: "faq:getPublishedFaqs" },
  },
}));

vi.mock("convex/_generated/api", () => ({
  api: mockApi,
}));

const renderFAQ = () =>
  render(
    <BrowserRouter>
      <FAQ />
    </BrowserRouter>
  );

describe("FAQ Page", () => {
  it("shows loading spinner while data is loading", () => {
    (useQuery as Mock).mockReturnValue(undefined);
    renderFAQ();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows empty state when no published FAQs", () => {
    (useQuery as Mock).mockReturnValue([]);
    renderFAQ();
    expect(screen.getByText(/no faq items published yet/i)).toBeInTheDocument();
  });

  it("renders FAQ items when loaded", () => {
    (useQuery as Mock).mockReturnValue([
      { _id: "1", question: "How do I bid?", answer: "Click the bid button." },
      {
        _id: "2",
        question: "What is KYC?",
        answer: "Know Your Customer verification.",
      },
    ]);
    renderFAQ();
    expect(screen.getByText("How do I bid?")).toBeInTheDocument();
    expect(screen.getByText("What is KYC?")).toBeInTheDocument();
  });

  it("renders the page heading", () => {
    (useQuery as Mock).mockReturnValue([]);
    renderFAQ();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders all published FAQ questions", () => {
    const faqs = Array.from({ length: 3 }, (_, i) => ({
      _id: String(i),
      question: `Question ${i + 1}`,
      answer: `Answer ${i + 1}`,
    }));
    (useQuery as Mock).mockReturnValue(faqs);
    renderFAQ();
    faqs.forEach((faq) => {
      expect(screen.getByText(faq.question)).toBeInTheDocument();
    });
  });
});
