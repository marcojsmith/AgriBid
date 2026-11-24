import { describe, expect, it } from "vitest";

import { lotTitle, lotTitleWithYear } from "./lotTitle";

describe("lotTitle", () => {
  it("joins make and model when the model is known", () => {
    expect(lotTitle({ make: "New Holland", model: "8030", title: "x" })).toBe(
      "New Holland 8030"
    );
  });

  it("falls back to the lot title, then the make", () => {
    expect(
      lotTitle({ make: "Other", model: " ", title: "3 disc plough" })
    ).toBe("3 disc plough");
    expect(lotTitle({ make: "Other", model: "", title: " " })).toBe("Other");
    expect(lotTitle({ make: "Other", model: "" })).toBe("Other");
  });
});

describe("lotTitleWithYear", () => {
  it("puts a known year first and drops 0", () => {
    const lot = { make: "John Deere", model: "8370RT", title: "x" };
    expect(lotTitleWithYear({ ...lot, year: 2016 })).toBe(
      "2016 John Deere 8370RT"
    );
    expect(lotTitleWithYear({ ...lot, year: 0 })).toBe("John Deere 8370RT");
  });
});
