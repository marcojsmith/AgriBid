import { render, screen } from "@testing-library/react";
import { api } from "convex/_generated/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetConvexState, setQuery } from "@/pages/register/testing";

import { CollectionCard } from "./CollectionCard";
import { fixtureLotId } from "./fixtures";

vi.mock("convex/react", async () => {
  const t = await import("@/pages/register/testing");
  return { useQuery: t.mockUseQuery };
});

const COLLECT_BY = Date.UTC(2026, 11, 1, 9, 0);

describe("CollectionCard", () => {
  beforeEach(() => {
    resetConvexState();
  });

  it("shows a skeleton while the details load", () => {
    const { container } = render(
      <CollectionCard lotId={fixtureLotId("jcb3cx")} />
    );
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("shows nothing when the server releases no details", () => {
    setQuery(api.lotPayments.getMyCollectionDetails, null);
    const { container } = render(
      <CollectionCard lotId={fixtureLotId("jcb3cx")} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows only the collect-by date when the seller gave no address or phone", () => {
    setQuery(api.lotPayments.getMyCollectionDetails, {
      sellerName: "Thandi N.",
      sellerPhone: null,
      collectionAddress: null,
      collectBy: COLLECT_BY,
    });
    render(<CollectionCard lotId={fixtureLotId("jcb3cx")} />);
    expect(
      screen.getByRole("region", { name: "Collection details" })
    ).toBeVisible();
    expect(screen.getByText("Tue 1 Dec")).toBeVisible();
    expect(screen.queryByText("Address")).toBeNull();
    expect(screen.queryByText("Seller phone")).toBeNull();
  });

  it("shows the address and a phone link", () => {
    setQuery(api.lotPayments.getMyCollectionDetails, {
      sellerName: "Thandi N.",
      sellerPhone: "+27 82 555 0188",
      collectionAddress: "Farm Rietfontein",
      collectBy: COLLECT_BY,
    });
    render(<CollectionCard lotId={fixtureLotId("jcb3cx")} />);
    expect(screen.getByText("Farm Rietfontein")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "+27 82 555 0188" })
    ).toHaveAttribute("href", "tel:+27825550188");
  });
});
