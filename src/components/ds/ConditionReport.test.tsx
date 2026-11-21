import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ConditionReport } from "./ConditionReport";

describe("ConditionReport", () => {
  it("shows Good for true and Wear noted for false, with text", () => {
    render(
      <ConditionReport
        checklist={{
          engine: true,
          hydraulics: false,
          tires: true,
          serviceHistory: true,
        }}
      />
    );
    expect(screen.getAllByText("Good")).toHaveLength(3);
    expect(screen.getByText("Wear noted")).toBeInTheDocument();
  });

  it("shows Not reported for missing values and when there is no checklist", () => {
    const { rerender } = render(
      <ConditionReport checklist={{ engine: true }} />
    );
    expect(screen.getAllByText("Not reported")).toHaveLength(3);
    rerender(<ConditionReport checklist={null} />);
    expect(screen.getAllByText("Not reported")).toHaveLength(4);
    expect(screen.queryByText("Good")).not.toBeInTheDocument();
  });

  it("shows seller notes only when non-blank", () => {
    const { rerender } = render(
      <ConditionReport checklist={{ notes: "  New tyres fitted  " }} />
    );
    expect(screen.getByText("New tyres fitted")).toBeInTheDocument();
    rerender(<ConditionReport checklist={{ notes: "   " }} />);
    expect(screen.queryByText(/Seller notes/)).not.toBeInTheDocument();
  });

  it("links to the PDF safely when provided", () => {
    const { rerender } = render(
      <ConditionReport pdfHref="https://x.test/r.pdf" />
    );
    const link = screen.getByRole("link", { name: "Inspection report (PDF)" });
    expect(link).toHaveAttribute("href", "https://x.test/r.pdf");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    rerender(<ConditionReport />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
