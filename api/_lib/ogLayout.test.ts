// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  chooseCardKind,
  renderOgCard,
  saleTitleSize,
  splitDateTime,
} from "./ogLayout";

describe("splitDateTime", () => {
  it("splits the date and the time", () => {
    // 2026-11-25 09:00 UTC = 11:00 SAST
    expect(splitDateTime(Date.UTC(2026, 10, 25, 9, 0))).toEqual({
      date: "Wed 25 Nov",
      time: "11:00",
    });
  });

  it("returns empty lines for a bad timestamp", () => {
    expect(splitDateTime(Number.NaN)).toEqual({ date: "", time: "" });
  });
});

describe("saleTitleSize", () => {
  it("uses 58px up to 18 characters and 44px beyond", () => {
    expect(saleTitleSize("Year End Auction")).toBe(58);
    expect(saleTitleSize("a".repeat(18))).toBe(58);
    expect(saleTitleSize("a".repeat(19))).toBe(44);
  });
});

describe("chooseCardKind", () => {
  it("falls back to the home card without enough photos", () => {
    expect(chooseCardKind("lot", 0)).toBe("home");
    expect(chooseCardKind("lot", 1)).toBe("lot");
    expect(chooseCardKind("sale", 2)).toBe("home");
    expect(chooseCardKind("sale", 3)).toBe("sale");
    expect(chooseCardKind("home", 3)).toBe("home");
  });
});

describe("renderOgCard", () => {
  const photo = {
    fg: "data:image/jpeg;base64,AA",
    bg: "data:image/jpeg;base64,AA",
  };
  const ts = Date.UTC(2026, 10, 25, 9, 0);

  it("builds an element for every card kind", () => {
    const cards = [
      renderOgCard({
        kind: "lot",
        title: "New Holland T6070",
        lotNumber: 3,
        sold: true,
        priceLabel: "Sold for",
        price: "R 428 000",
        timeLabel: "Closed",
        timestamp: ts,
        photo,
      }),
      renderOgCard({
        kind: "lot",
        title: "New Holland T6070",
        sold: false,
        priceLabel: "Opening bid",
        price: "R 400 000",
        timeLabel: "Closes",
        photo,
      }),
      renderOgCard({
        kind: "sale",
        saleTitle: "Year End Auction",
        lotCount: 85,
        sub: "Online",
        timeLabel: "Closes",
        timestamp: ts,
        tiles: ["a", "b", "c"],
      }),
      renderOgCard({
        kind: "home",
        live: true,
        rightLabel: "Sale",
        timestamp: ts,
        photo,
      }),
      renderOgCard({ kind: "home", live: false, rightLabel: "" }),
    ];
    for (const card of cards) {
      expect(card.type).toBe("div");
    }
  });
});
