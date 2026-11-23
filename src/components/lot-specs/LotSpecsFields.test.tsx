import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LotSpecsFields } from "./LotSpecsFields";

describe("LotSpecsFields", () => {
  it("renders labelled inputs with the current values", () => {
    render(
      <LotSpecsFields
        idPrefix="t"
        values={{
          powerKw: 120,
          drive: "4wd",
          transmission: "Powershift",
          frontTyrePct: 70,
          rearTyrePct: 60,
          serialNumber: "SN1",
        }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Power (kW)")).toHaveValue(120);
    expect(screen.getByLabelText("Drive")).toHaveValue("4wd");
    expect(screen.getByLabelText("Transmission")).toHaveValue("Powershift");
    expect(screen.getByLabelText("Front tyre (%)")).toHaveValue(70);
    expect(screen.getByLabelText("Rear tyre (%)")).toHaveValue(60);
    expect(screen.getByLabelText("Serial number")).toHaveValue("SN1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports changes as patches", () => {
    const onChange = vi.fn();
    render(<LotSpecsFields idPrefix="t" values={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Power (kW)"), {
      target: { value: "150" },
    });
    expect(onChange).toHaveBeenLastCalledWith({ powerKw: 150 });

    fireEvent.change(screen.getByLabelText("Drive"), {
      target: { value: "tracks" },
    });
    expect(onChange).toHaveBeenLastCalledWith({ drive: "tracks" });

    fireEvent.change(screen.getByLabelText("Transmission"), {
      target: { value: "CVT" },
    });
    expect(onChange).toHaveBeenLastCalledWith({ transmission: "CVT" });

    fireEvent.change(screen.getByLabelText("Serial number"), {
      target: { value: "ABC" },
    });
    expect(onChange).toHaveBeenLastCalledWith({ serialNumber: "ABC" });
  });

  it("clears a number and a drive back to undefined", () => {
    const onChange = vi.fn();
    render(
      <LotSpecsFields
        idPrefix="t"
        values={{ powerKw: 150, drive: "2wd" }}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText("Power (kW)"), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenLastCalledWith({ powerKw: undefined });
    fireEvent.change(screen.getByLabelText("Drive"), {
      target: { value: "" },
    });
    expect(onChange).toHaveBeenLastCalledWith({ drive: undefined });
  });

  it("shows an inline error for out-of-range values", () => {
    render(
      <LotSpecsFields
        idPrefix="t"
        values={{ frontTyrePct: 150 }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Front tyre must be between 0 and 100%"
    );
    expect(screen.getByLabelText("Front tyre (%)")).toHaveAttribute(
      "aria-describedby",
      "t-error"
    );
  });

  it("disables inputs when asked", () => {
    render(
      <LotSpecsFields idPrefix="t" values={{}} onChange={vi.fn()} disabled />
    );
    expect(screen.getByLabelText("Power (kW)")).toBeDisabled();
    expect(screen.getByLabelText("Drive")).toBeDisabled();
  });
});
