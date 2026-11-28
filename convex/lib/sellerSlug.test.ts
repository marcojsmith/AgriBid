import { describe, it, expect } from "vitest";

import {
  firstWordOf,
  MAX_SLUG_LENGTH,
  publicNameFor,
  slugBaseFor,
  slugHasBase,
  slugify,
} from "./sellerSlug";

describe("publicNameFor", () => {
  it("prefers the trimmed company name", () => {
    expect(
      publicNameFor({
        companyName: "  Wolmaransstad   Boerdery ",
        firstName: "Thandi",
        lastName: "Nkosi",
      })
    ).toBe("Wolmaransstad Boerdery");
  });

  it("uses first name plus the surname initial", () => {
    expect(publicNameFor({ firstName: " Thandi ", lastName: "nkosi" })).toBe(
      "Thandi N."
    );
  });

  it("uses the first name alone when there is no surname", () => {
    expect(publicNameFor({ firstName: "Thandi", lastName: "  " })).toBe(
      "Thandi"
    );
  });

  it("falls back to the first and last words of name", () => {
    expect(publicNameFor({ name: "Hennie van der Merwe" })).toBe("Hennie M.");
  });

  it("uses a single-word name as is", () => {
    expect(publicNameFor({ name: " Hennie " })).toBe("Hennie");
  });

  it("ignores a blank company name", () => {
    expect(publicNameFor({ companyName: "   ", name: "A B" })).toBe("A B.");
  });

  it("returns null when nothing is usable", () => {
    expect(publicNameFor({})).toBeNull();
    expect(
      publicNameFor({ companyName: " ", firstName: "", name: "  " })
    ).toBeNull();
  });

  it("does not split an emoji initial in half", () => {
    expect(publicNameFor({ firstName: "Ann", lastName: "😀Smith" })).toBe(
      "Ann 😀."
    );
  });
});

describe("slugify", () => {
  it("lower-cases and joins words with hyphens", () => {
    expect(slugify("Wolmaransstad Boerdery")).toBe("wolmaransstad-boerdery");
  });

  it("strips accents", () => {
    expect(slugify("Café Müller Çiftlik")).toBe("cafe-muller-ciftlik");
  });

  it("maps letters that do not decompose", () => {
    expect(slugify("Straße Ærø")).toBe("strasse-aero");
  });

  it("drops apostrophes instead of splitting the word", () => {
    expect(slugify("Du Toit's Boerdery")).toBe("du-toits-boerdery");
    expect(slugify("Du Toit’s Boerdery")).toBe("du-toits-boerdery");
  });

  it("removes emoji and collapses separators", () => {
    expect(slugify("🚜  Tractor -- Deals 🚜")).toBe("tractor-deals");
  });

  it("returns an empty string for a name made of symbols only", () => {
    expect(slugify("★★★ !!! 🚜")).toBe("");
  });

  it("caps the slug without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(59)} bbbbbbbb`);
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toBe("a".repeat(59));
  });
});

describe("slugBaseFor", () => {
  it("returns the slug of the name", () => {
    expect(slugBaseFor("Thandi N.")).toBe("thandi-n");
  });

  it("falls back to a fixed base for symbol-only names", () => {
    expect(slugBaseFor("★★★")).toBe("seller");
  });
});

describe("slugHasBase", () => {
  it("matches the base and its numbered clashes only", () => {
    expect(slugHasBase("thandi-n", "thandi-n")).toBe(true);
    expect(slugHasBase("thandi-n-2", "thandi-n")).toBe(true);
    expect(slugHasBase("thandi-n-12", "thandi-n")).toBe(true);
    expect(slugHasBase("thandi-n-x", "thandi-n")).toBe(false);
    expect(slugHasBase("thandi-nkosi", "thandi-n")).toBe(false);
    expect(slugHasBase("other", "thandi-n")).toBe(false);
  });
});

describe("firstWordOf", () => {
  it("returns the first word only", () => {
    expect(firstWordOf("  Alice Bezuidenhout ")).toBe("Alice");
  });

  it("returns undefined for blank input", () => {
    expect(firstWordOf("   ")).toBeUndefined();
    expect(firstWordOf(undefined)).toBeUndefined();
    expect(firstWordOf(null)).toBeUndefined();
  });
});
