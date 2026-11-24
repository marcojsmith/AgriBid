import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { LotCard, type LotCardLot } from "./LotCard";

const LOT: LotCardLot = {
  number: 3,
  title: "New Holland T6070",
  href: "/lots/3",
  photoSrc: "https://example.com/a.jpg",
  year: 2016,
  hours: 4850,
  town: "Malmesbury",
};

describe("LotCard", () => {
  it("shows an open lot: opening bid, reserve applies, watchers and a heart", () => {
    const onToggleWatch = vi.fn();
    render(
      <LotCard
        lot={LOT}
        state="open"
        price={400_000}
        count={8}
        reserve="applies"
        onToggleWatch={onToggleWatch}
      />
    );
    expect(screen.getByText("Lot 3")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "New Holland T6070" })
    ).toHaveAttribute("href", "/lots/3");
    expect(screen.getByText("2016 · 4 850 hrs")).toBeInTheDocument();
    expect(
      screen.getByText("Malmesbury", { exact: false })
    ).toBeInTheDocument();
    expect(screen.getByText("Reserve applies")).toBeInTheDocument();
    expect(screen.getByText("Opening bid")).toBeInTheDocument();
    expect(screen.getByText("R 400 000")).toBeInTheDocument();
    expect(screen.getByText("8 watching")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Watch lot 3, New Holland T6070" })
    );
    expect(onToggleWatch).toHaveBeenCalledTimes(1);
  });

  it("shows a current bid with the reserve state, bid count and a filled heart when watching", () => {
    render(
      <LotCard
        lot={LOT}
        state="current-bid"
        price={414_000}
        count={7}
        reserve="not-met"
        watching
        onToggleWatch={() => undefined}
        closesIn="2d 3h"
      />
    );
    expect(screen.getByText("Current bid")).toBeInTheDocument();
    expect(screen.getByText("Reserve not met")).toBeInTheDocument();
    expect(screen.getByText("7 bids")).toBeInTheDocument();
    expect(screen.getByText(/Closes in 2d 3h/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Watching lot 3, New Holland T6070" })
    ).toBeInTheDocument();
  });

  it("shows no reserve pill when the page does not know the reserve state", () => {
    render(<LotCard lot={LOT} state="current-bid" price={414_000} count={7} />);
    expect(screen.queryByText(/reserve/i)).toBeNull();
  });

  it("shows no watching line when nobody watches", () => {
    render(<LotCard lot={LOT} state="open" price={100_000} count={0} />);
    expect(screen.queryByText(/watching/)).toBeNull();
  });

  it("accepts an explicit reserve state and singular bid count", () => {
    render(
      <LotCard
        lot={LOT}
        state="current-bid"
        price={500_000}
        count={1}
        reserve="met"
      />
    );
    expect(screen.getByText("Reserve met")).toBeInTheDocument();
    expect(screen.getByText("1 bid")).toBeInTheDocument();
  });

  it.each([
    ["sold", "Sold for", "Sold"],
    ["not-sold", "Highest bid", "Not sold"],
    ["under-consideration", "Top bid", "Under consideration"],
  ] as const)(
    "shows %s with its price label and pill, and no heart",
    (state, label, pill) => {
      render(
        <LotCard
          lot={LOT}
          state={state}
          price={428_000}
          count={9}
          watching
          onToggleWatch={() => undefined}
        />
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(pill)).toBeInTheDocument();
      expect(screen.getByText("9 bids")).toBeInTheDocument();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByText(/Reserve/)).toBeNull();
    }
  );

  it("hides the heart without a handler and drops unknown specs rather than showing N/A", () => {
    const { container } = render(
      <LotCard
        lot={{
          number: "12",
          title: "Trailer",
          href: "/lots/12",
          photoSrc: null,
        }}
        state="open"
        price={50_000}
        className="extra"
      />
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.textContent).not.toMatch(/N\/A|undefined|null|hrs/);
    expect(container.firstElementChild).toHaveClass("extra");
    expect(screen.queryByText(/watching/)).toBeNull();
  });

  it("shows only the status, with no figure, when no price is given", () => {
    render(<LotCard lot={LOT} state="not-sold" />);
    expect(screen.getByText("Not sold")).toBeVisible();
    expect(screen.queryByText("Highest bid")).toBeNull();
    expect(screen.queryByText(/bids?$/)).toBeNull();
  });
});
