import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ConditionItem } from "./ConditionItem";

describe("ConditionItem", () => {
  it("renders with true value as PASS with check icon", () => {
    render(<ConditionItem label="Engine" value={true} />);

    expect(screen.getByText("Engine")).toBeInTheDocument();
    expect(screen.getByText("PASS")).toBeInTheDocument();
  });

  it("renders with false value as FAIL with X icon", () => {
    render(<ConditionItem label="Brakes" value={false} />);

    expect(screen.getByText("Brakes")).toBeInTheDocument();
    expect(screen.getByText("FAIL")).toBeInTheDocument();
  });

  it("renders with undefined value as N/A with dash", () => {
    render(<ConditionItem label="Transmission" value={undefined} />);

    expect(screen.getByText("Transmission")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("renders label correctly", () => {
    render(<ConditionItem label="Test Label" value={true} />);

    expect(screen.getByText("Test Label")).toBeInTheDocument();
  });

  it("renders PASS for true value", () => {
    render(<ConditionItem label="Test" value={true} />);

    expect(screen.getByText("PASS")).toBeInTheDocument();
  });

  it("renders FAIL for false value", () => {
    render(<ConditionItem label="Test" value={false} />);

    expect(screen.getByText("FAIL")).toBeInTheDocument();
  });

  it("renders N/A for undefined value", () => {
    render(<ConditionItem label="Test" value={undefined} />);

    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("handles required label prop", () => {
    render(<ConditionItem label="Required" value={true} />);

    expect(screen.getByText("Required")).toBeInTheDocument();
  });
});
