import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SpecTable } from "./SpecTable";

describe("SpecTable", () => {
  it("renders labels and values as a definition list", () => {
    const { container } = render(
      <SpecTable
        items={[
          { label: "Make", value: "John Deere" },
          { label: "Year", value: 2019 },
        ]}
      />
    );
    expect(container.querySelector("dl")).toBeInTheDocument();
    expect(screen.getByText("Make").tagName).toBe("DT");
    expect(screen.getByText("John Deere").tagName).toBe("DD");
    expect(screen.getByText("2019")).toBeInTheDocument();
  });

  it("drops rows with no value but keeps zero", () => {
    render(
      <SpecTable
        items={[
          { label: "Hours", value: 0 },
          { label: "Colour", value: "" },
          { label: "Model" },
        ]}
      />
    );
    expect(screen.getByText("Hours")).toBeInTheDocument();
    expect(screen.queryByText("Colour")).not.toBeInTheDocument();
    expect(screen.queryByText("Model")).not.toBeInTheDocument();
  });

  it("renders nothing when no row has a value", () => {
    const { container } = render(<SpecTable items={[{ label: "Make" }]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
