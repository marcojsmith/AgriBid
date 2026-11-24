import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

import { safeCallbackPath } from "@/lib/registrationCopy";

/** The lot a buyer is registering to bid on. */
export interface CallbackLot {
  lotNumber?: number;
  title: string;
  closesAt?: number;
  photoUrl?: string;
}

/** Where the registration flow returns to, and what to call it. */
export interface CallbackTarget {
  /** A same-origin relative path. */
  href: string;
  /** "Lot 3 · New Holland T6070" for a lot, otherwise "Back". */
  label: string;
  /** The lot, once loaded. */
  lot?: CallbackLot;
}

/** A lot page path. The server decides whether the id is a real lot. */
const LOT_PATH = /^\/auction\/([A-Za-z0-9_-]{1,64})\/?$/;

/**
 * Reads the lot id out of a callback path such as `/auction/<id>?x=1`.
 *
 * @param path - A safe relative path
 * @returns The id, or null when the path is not a lot page
 */
function lotIdOf(path: string): string | null {
  const pathname = path.split(/[?#]/, 1)[0] ?? "";
  const match = LOT_PATH.exec(pathname);
  return match?.[1] ?? null;
}

/**
 * Resolves the `callbackUrl` of the registration flow. Only a same-origin
 * relative path is accepted (an absolute URL, `//host`, `/\host` or a
 * scheme is rejected). A `/auction/:id` path is looked up with
 * `getLotHeadline` so the pages can show the lot's number, title and photo.
 *
 * @param callbackUrl - The raw `callbackUrl` search parameter
 * @returns The target, or null when there is no safe callback
 */
export function useCallbackLot(
  callbackUrl: string | null
): CallbackTarget | null {
  const href = safeCallbackPath(callbackUrl);
  const lotId = href ? lotIdOf(href) : null;
  const headline = useQuery(
    api.auctions.getLotHeadline,
    lotId ? { lotId } : "skip"
  );

  if (!href) return null;
  if (!headline) return { href, label: "Back" };

  const label =
    headline.lotNumber === undefined
      ? headline.title
      : `Lot ${String(headline.lotNumber)} · ${headline.title}`;
  return { href, label, lot: headline };
}
