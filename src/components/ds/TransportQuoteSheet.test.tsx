import { createContext, useContext, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const SelectContext = createContext<(value: string) => void>(() => undefined);

// Radix Select is unreliable in jsdom, so use a plain stand-in.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    onValueChange: (value: string) => void;
  }) => (
    <SelectContext.Provider value={onValueChange}>
      {children}
    </SelectContext.Provider>
  ),
  SelectTrigger: ({ id, children }: { id?: string; children?: ReactNode }) => (
    <button type="button" role="combobox" id={id}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => {
    const onChange = useContext(SelectContext);
    return (
      <button
        type="button"
        role="option"
        onClick={() => {
          onChange(value);
        }}
      >
        {children}
      </button>
    );
  },
}));

import { TransportQuoteSheet } from "./TransportQuoteSheet";

const lot = {
  label: "John Deere 5075E · Lot 4",
  place: "Malmesbury, Western Cape",
};

/**
 * Renders the sheet open.
 *
 * @param props - Prop overrides
 * @returns The spies
 */
function setup(props: Partial<Parameters<typeof TransportQuoteSheet>[0]> = {}) {
  const onSubmit = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <TransportQuoteSheet
      open
      onOpenChange={onOpenChange}
      busy={false}
      error={null}
      onSubmit={onSubmit}
      {...props}
    />
  );
  return { onSubmit, onOpenChange };
}

/** Picks Free State in the province select. */
function chooseProvince() {
  fireEvent.click(screen.getByRole("option", { name: "Free State" }));
}

/**
 * Types into a field.
 *
 * @param label - The field label
 * @param value - The text
 */
function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("TransportQuoteSheet", () => {
  it("shows the lot lines when there is a lot", () => {
    setup({ lot });
    expect(
      screen.getByRole("dialog", { name: "Request a transport quote" })
    ).toBeVisible();
    expect(screen.getByText("John Deere 5075E · Lot 4")).toBeInTheDocument();
    expect(
      screen.getByText("Collect from Malmesbury, Western Cape")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Collect from")).toBeNull();
  });

  it("asks where to collect from when there is no lot", () => {
    setup();
    expect(screen.getByLabelText("Collect from")).toBeInTheDocument();
  });

  it("prefills the name and phone, including when they arrive late", () => {
    const { rerender } = render(
      <TransportQuoteSheet
        open
        onOpenChange={() => undefined}
        busy={false}
        error={null}
        onSubmit={() => undefined}
      />
    );
    expect(screen.getByLabelText("Your name")).toHaveValue("");
    rerender(
      <TransportQuoteSheet
        open
        onOpenChange={() => undefined}
        busy={false}
        error={null}
        onSubmit={() => undefined}
        defaultName="Thandi"
        defaultPhone="0837000000"
      />
    );
    expect(screen.getByLabelText("Your name")).toHaveValue("Thandi");
    expect(screen.getByLabelText("Phone")).toHaveValue("0837000000");
    expect(screen.getByLabelText("Phone")).toHaveAttribute("inputmode", "tel");
  });

  it("shows a province placeholder until one is chosen", () => {
    setup();
    expect(screen.getByText("Choose a province")).toBeInTheDocument();
  });

  it("shows the exact inline errors for an empty form", () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(
      screen.getByText("Enter a South African phone number, like 083 700 0000.")
    ).toBeInTheDocument();
    expect(screen.getByText("Enter the delivery town.")).toBeInTheDocument();
    expect(screen.getByText("Choose a province.")).toBeInTheDocument();
    expect(screen.getByText("Enter your name.")).toBeInTheDocument();
    expect(
      screen.getByText("Enter where to collect from.")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits trimmed values", () => {
    const { onSubmit } = setup();
    type("Collect from", "  Paarl ");
    type("Deliver to (town)", " Bloem ");
    chooseProvince();
    type("Your name", " Thandi ");
    type("Phone", " 083 700 0000 ");
    type("Notes (optional)", " two ");
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(onSubmit).toHaveBeenCalledWith({
      pickup: "Paarl",
      deliveryTown: "Bloem",
      deliveryProvince: "free_state",
      name: "Thandi",
      phone: "083 700 0000",
      notes: "two",
    });
  });

  it("leaves pickup and notes out when there is a lot and no notes", () => {
    const { onSubmit } = setup({
      lot,
      defaultName: "Thandi",
      defaultPhone: "0837000000",
    });
    type("Deliver to (town)", "Bloem");
    chooseProvince();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(onSubmit).toHaveBeenCalledWith({
      deliveryTown: "Bloem",
      deliveryProvince: "free_state",
      name: "Thandi",
      phone: "0837000000",
    });
  });

  it("disables Send request while busy", () => {
    setup({ busy: true });
    expect(screen.getByRole("button", { name: "Send request" })).toBeDisabled();
  });

  it("shows the server error", () => {
    setup({ error: "Too many requests. Try again later." });
    expect(
      screen.getByText("Too many requests. Try again later.")
    ).toBeInTheDocument();
  });

  it("closes on Cancel", () => {
    const { onOpenChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("resets the form when it closes", () => {
    const props = {
      onOpenChange: () => undefined,
      busy: false,
      error: null,
      onSubmit: () => undefined,
    };
    const { rerender } = render(<TransportQuoteSheet open {...props} />);
    type("Deliver to (town)", "Bloem");
    rerender(<TransportQuoteSheet open={false} {...props} />);
    rerender(<TransportQuoteSheet open {...props} />);
    expect(screen.getByLabelText("Deliver to (town)")).toHaveValue("");
  });
});
