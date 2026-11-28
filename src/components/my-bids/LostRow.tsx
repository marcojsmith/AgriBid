import { formatRand } from "@/lib/currency";
import { formatSastDate } from "@/lib/dates";

import { RowBadge } from "./RowBadge";
import { Figure, RowLayout } from "./RowLayout";
import type { MyBidRow } from "./types";

/**
 * A lot the buyer did not win. Sold to someone else: "Lost" with the buyer's
 * bid and what it sold for. Closed without a sale: "Not sold" with the buyer's
 * highest bid and the reserve state.
 *
 * @param props - Component props
 * @param props.row - The row from `getMyBidsOverview`
 * @returns The row
 */
export function LostRow({ row }: { row: MyBidRow }) {
  const sold = row.status === "sold";
  const closedAt = row.extendedEndTime ?? row.auctionEndTime;
  return (
    <RowLayout
      label={row.title}
      lot={{ ...row, photo: row.images.front }}
      badge={
        sold ? (
          <RowBadge kind="lost">Lost</RowBadge>
        ) : (
          <RowBadge kind="not-sold">Not sold</RowBadge>
        )
      }
      figures={
        sold ? (
          <>
            <Figure label="Your bid">{formatRand(row.myHighestBid)}</Figure>
            <Figure label="Sold for">{formatRand(row.currentPrice)}</Figure>
          </>
        ) : (
          <>
            <Figure label="Your highest bid">
              {formatRand(row.myHighestBid)}
            </Figure>
            <Figure label="Reserve">Not met</Figure>
          </>
        )
      }
      footer={
        closedAt === undefined ? null : (
          <p className="text-[15px]">Closed {formatSastDate(closedAt)}</p>
        )
      }
    />
  );
}
