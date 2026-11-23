import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import {
  ConditionSection,
  IfYouWinSection,
  SpecsSection,
  ViewCollect,
  type SpecsLot,
} from "./LotSections";

const phone = { text: "083 7 000 000", tel: "tel:0837000000" };

describe("ConditionSection", () => {
  it("lists the seller's words, FICA, a VAT seller and the viewing call", () => {
    render(
      <ConditionSection
        sellerNotes="starts, runs and drives. No known faults."
        sellerVatKind="vat"
        sellerTypeLabel="Farming business"
        phone={phone}
      />
    );
    expect(
      screen.getByText("Seller says: starts, runs and drives. No known faults.")
    ).toBeInTheDocument();
    expect(screen.getByText("Seller ID checked (FICA)")).toBeInTheDocument();
    expect(
      screen.getByText("Seller: Farming business · VAT registered")
    ).toBeInTheDocument();
    expect(screen.getByText("VAT: tax invoice issued")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "083 7 000 000" })).toHaveAttribute(
      "href",
      "tel:0837000000"
    );
    expect(
      screen.getByText(/Sold as is\. Book a viewing before you bid/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/cold-start/i)).toBeNull();
    expect(screen.queryByText(/Inspected by AgriBid/i)).toBeNull();
  });

  it("private seller: no VAT on the bid", () => {
    render(
      <ConditionSection
        sellerVatKind="private"
        sellerTypeLabel="Private farmer"
        phone={phone}
      />
    );
    expect(screen.getByText("Seller: Private farmer")).toBeInTheDocument();
    expect(
      screen.getByText("No VAT on the bid (private seller)")
    ).toBeInTheDocument();
    expect(screen.queryByText(/Seller says/)).toBeNull();
  });

  it("falls back without a type label, a phone or notes, and links the PDF", () => {
    const { rerender } = render(
      <ConditionSection sellerVatKind="private" reportHref="/r.pdf" />
    );
    expect(screen.getByText("Seller: Private seller")).toBeInTheDocument();
    expect(screen.getByText("Sold as is.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /inspection report/i })
    ).toHaveAttribute("href", "/r.pdf");
    rerender(<ConditionSection sellerVatKind="vat" />);
    expect(screen.getByText("Seller: VAT registered")).toBeInTheDocument();
  });
});

describe("IfYouWinSection", () => {
  it("lists the four steps with the deposit counting towards payment", () => {
    render(<IfYouWinSection deposit={5000} />);
    const steps = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent.replace(/[\u202f\u00a0]/g, " "));
    expect(steps[0]).toContain(
      "We email your invoice when the auction closes."
    );
    expect(steps[1]).toContain("Pay by EFT within 48 hours.");
    expect(steps[2]).toContain("Your R 5 000 deposit counts towards payment.");
    expect(steps[3]).toContain(
      "Collect within 7 days of payment, or we arrange transport."
    );
  });

  it("drops the deposit step when no deposit is charged", () => {
    render(<IfYouWinSection />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText(/deposit/)).toBeNull();
  });
});

const lot: SpecsLot = {
  year: 2016,
  operatingHours: 4850,
  powerKw: 104,
  drive: "4wd",
  transmission: "Semi-powershift",
  frontTyrePct: 70,
  rearTyrePct: 65,
  serialNumber: "ZBJC12345",
  make: "New Holland",
  model: "T6070",
};

describe("SpecsSection", () => {
  it("shows every spec and a 'See meter photo' link that opens the photo", () => {
    const onSeeMeter = vi.fn();
    render(<SpecsSection lot={lot} onSeeMeter={onSeeMeter} />);
    for (const value of [
      "2016",
      "104 kW",
      "4WD",
      "Semi-powershift",
      "Front 70% · Rear 65%",
      "ZBJC12345",
      "New Holland",
      "T6070",
    ]) {
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    expect(screen.getByText(/4 850 hrs/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "See meter photo" }));
    expect(onSeeMeter).toHaveBeenCalledOnce();
  });

  it("hides empty rows and the meter link when there is no meter photo", () => {
    render(
      <SpecsSection
        lot={{
          year: 2010,
          operatingHours: 0,
          make: "Ford",
          model: "5000",
          frontTyrePct: 50,
        }}
      />
    );
    expect(screen.queryByText("Power")).toBeNull();
    expect(screen.queryByText("Drive")).toBeNull();
    expect(screen.queryByText("Hours")).toBeNull();
    expect(screen.queryByText("Serial no.")).toBeNull();
    expect(screen.getByText("Front 50%")).toBeInTheDocument();
    render(<SpecsSection lot={{ ...lot, drive: "2wd" }} />);
    expect(
      screen.queryByRole("button", { name: "See meter photo" })
    ).toBeNull();
    expect(screen.getByText("2WD")).toBeInTheDocument();
  });
});

describe("ViewCollect", () => {
  const finance = {
    name: "Lee-Anne Vermeulen",
    company: "com-fin",
    phone: "083 277 0178",
    tel: "tel:0832770178",
  };

  it("shows the location, call to book, transport quote and the finance contact", () => {
    render(
      <MemoryRouter>
        <ViewCollect
          place="Malmesbury, Western Cape"
          phone={phone}
          finance={finance}
        />
      </MemoryRouter>
    );
    expect(
      screen.getByText(/Stands near Malmesbury, Western Cape\./)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "083 7 000 000" })).toHaveAttribute(
      "href",
      "tel:0837000000"
    );
    expect(
      screen.getByRole("link", { name: /Request a transport quote/ })
    ).toHaveAttribute("href", "/support");
    expect(
      screen.getByRole("link", {
        name: /Need finance\? Lee-Anne Vermeulen, com-fin, 083 277 0178/,
      })
    ).toHaveAttribute("href", "tel:0832770178");
    expect(
      screen.getByRole("heading", { name: "View & collect" })
    ).toBeInTheDocument();
  });

  it("hides the finance row without a number and the heading when asked", () => {
    render(
      <MemoryRouter>
        <ViewCollect
          heading={false}
          place=""
          finance={{ name: null, phone: null }}
        />
      </MemoryRouter>
    );
    expect(screen.queryByText(/Need finance/)).toBeNull();
    expect(screen.queryByText(/Stands near/)).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("names no finance contact person when none is set", () => {
    render(
      <MemoryRouter>
        <ViewCollect
          place="Cradock"
          finance={{ name: null, phone: "083 277 0178", tel: "tel:0832770178" }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/Need finance\? 083 277 0178/)).toBeInTheDocument();
    expect(screen.getByText(/Stands near Cradock\./)).toBeInTheDocument();
  });
});
