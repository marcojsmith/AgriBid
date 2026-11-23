import { getEventBucket, type EventBucket } from "@/lib/auction-utils";

/** The fields of a published sale the Home helpers need. */
export interface HomeSaleWindow {
  status: "draft" | "published" | "closed";
  startTime: number;
  endTime: number;
  effectiveEndTime: number;
}

/** A sale with its derived bucket (live or upcoming; closed sales are dropped). */
export type HomeSale<T extends HomeSaleWindow> = T & {
  bucket: Exclude<EventBucket, "closed">;
};

/** What Home shows at the top. */
export interface HomeSales<T extends HomeSaleWindow> {
  /** The sale the hero describes: the live sale that closes first, else the next to open. */
  hero: HomeSale<T> | null;
  /** Every live then upcoming sale, soonest first (live by close, upcoming by opening). */
  open: HomeSale<T>[];
  /** `multi` when two or more sales are live or upcoming. */
  mode: "none" | "single" | "multi";
}

/**
 * Picks the sales Home shows. Time-dependent, so it runs on the client with
 * `now` (a cached query cannot track time). Closed sales drop out; live sales
 * come before upcoming ones.
 *
 * @param events - Published sales from `getPublishedAuctions`
 * @param now - Current time (ms)
 * @returns The hero sale, the open sales in order and the layout mode
 */
export function pickHomeSales<T extends HomeSaleWindow>(
  events: readonly T[],
  now: number
): HomeSales<T> {
  const open = events.flatMap((event): HomeSale<T>[] => {
    const bucket = getEventBucket(event, now);
    return bucket === "closed" ? [] : [{ ...event, bucket }];
  });
  open.sort((a, b) =>
    a.bucket === b.bucket
      ? a.bucket === "live"
        ? a.effectiveEndTime - b.effectiveEndTime
        : a.startTime - b.startTime
      : a.bucket === "live"
        ? -1
        : 1
  );
  return {
    hero: open[0] ?? null,
    open,
    mode: open.length === 0 ? "none" : open.length === 1 ? "single" : "multi",
  };
}

/**
 * Words a lot count: "1 lot", "85 lots", or "100+ lots" when the count is a
 * lower bound because a sale held more lots than were read.
 *
 * @param count - The number of lots
 * @param capped - Whether the count is only a lower bound
 * @returns The text
 */
export function formatLotCount(count: number, capped = false): string {
  return `${String(count)}${capped ? "+" : ""} ${count === 1 && !capped ? "lot" : "lots"}`;
}

/**
 * Builds a wa.me link from a phone number (digits only, country code
 * included).
 *
 * @param whatsapp - The configured WhatsApp number in any format, or empty
 * @returns The link, or undefined when no usable number is set
 */
export function whatsappLink(
  whatsapp: string | null | undefined
): string | undefined {
  const digits = (whatsapp ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : undefined;
}

/**
 * Builds a tel: link from a phone number.
 *
 * @param telephone - The configured phone number in any format, or empty
 * @returns The link, or undefined when no number is set
 */
export function telLink(
  telephone: string | null | undefined
): string | undefined {
  const cleaned = (telephone ?? "").replace(/[^0-9+]/g, "");
  return cleaned ? `tel:${cleaned}` : undefined;
}
