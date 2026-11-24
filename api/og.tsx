import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "@vercel/og";
import sharp from "sharp";

import { formatRand } from "../src/lib/currency.js";
import { lotTitle } from "../src/lib/lotTitle.js";
import {
  loadShare,
  roundToMinute,
  type LoadedShare,
  type ShareKind,
} from "./_lib/loadShare.js";
import {
  chooseCardKind,
  renderOgCard,
  type OgCard,
  type OgPhoto,
} from "./_lib/ogLayout.js";
import { lotShareState } from "./_lib/shareMeta.js";

/** Shape of a cache key produced by `shareMeta`. */
const VERSION_KEY = /^[\w.%-]{1,100}$/;
const PHOTO_TIMEOUT_MS = 4000;
const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const JPEG_BUDGET_BYTES = 290 * 1024;

/**
 * Downloads a photo over https with a time and size limit.
 *
 * @param url - The photo URL
 * @returns The bytes, or null when it cannot be used
 */
async function fetchPhoto(url: string | undefined): Promise<Buffer | null> {
  if (!url?.startsWith("https://")) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS),
    });
    if (!res.ok || !res.body) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.byteLength;
      if (size > PHOTO_MAX_BYTES) return null;
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

/**
 * Turns bytes into a JPEG data URI of an exact size.
 *
 * @param input - Image bytes
 * @param width - Target width
 * @param height - Target height
 * @param blur - Blur the image and dim it (for backdrops)
 * @returns The data URI, or null when the image cannot be decoded
 */
async function toDataUri(
  input: Buffer,
  width: number,
  height: number,
  blur: boolean
): Promise<string | null> {
  try {
    let img = sharp(input).resize(width, height, { fit: "cover" });
    if (blur) img = img.blur(26).modulate({ brightness: 0.7 });
    const out = await img.jpeg({ quality: 85 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Builds the foreground and blurred backdrop of one photo.
 *
 * @param url - The photo URL
 * @returns The prepared photo, or null
 */
async function preparePhoto(url: string | undefined): Promise<OgPhoto | null> {
  const bytes = await fetchPhoto(url);
  if (!bytes) return null;
  const [fg, bg] = await Promise.all([
    toDataUri(bytes, 720, 420, false),
    toDataUri(bytes, 1200, 420, true),
  ]);
  return fg && bg ? { fg, bg } : null;
}

/**
 * Prepares the three collage tiles of a sale card.
 *
 * @param urls - Up to three photo URLs
 * @returns The tiles, or fewer when a photo failed
 */
async function prepareTiles(urls: string[]): Promise<string[]> {
  const sizes: [number, number][] = [
    [640, 420],
    [556, 208],
    [556, 208],
  ];
  const tiles = await Promise.all(
    sizes.map(async ([w, h], i) => {
      const bytes = await fetchPhoto(urls[i]);
      return bytes ? toDataUri(bytes, w, h, false) : null;
    })
  );
  return tiles.filter((tile): tile is string => tile !== null);
}

/**
 * Builds the card for loaded data, falling back to the photo-free home card.
 *
 * @param loaded - The loaded data
 * @param now - Current time in ms
 * @returns The card to draw
 */
async function buildCard(loaded: LoadedShare, now: number): Promise<OgCard> {
  if (loaded.kind === "lot" && loaded.data) {
    const lot = loaded.data;
    const photo = await preparePhoto(lot.imageUrl);
    if (chooseCardKind("lot", photo ? 1 : 0) === "lot" && photo) {
      const state = lotShareState(lot, now);
      const closed = state === "sold" || state === "closed";
      const label =
        state === "sold"
          ? "Sold for"
          : state === "current"
            ? "Current bid"
            : "Opening bid";
      const price =
        state === "sold" || state === "current"
          ? lot.currentPrice
          : lot.startingPrice;
      return {
        kind: "lot",
        title: lotTitle(lot),
        lotNumber: lot.lotNumber,
        sold: state === "sold",
        priceLabel: closed && state !== "sold" ? "Bidding" : label,
        price: closed && state !== "sold" ? "closed" : formatRand(price),
        timeLabel:
          state === "upcoming" ? "Opens" : closed ? "Closed" : "Closes",
        timestamp: state === "upcoming" ? lot.auctionStartTime : lot.closeTime,
        photo,
      };
    }
  }
  if (loaded.kind === "sale" && loaded.data) {
    const sale = loaded.data;
    const tiles = await prepareTiles(sale.imageUrls);
    if (chooseCardKind("sale", tiles.length) === "sale") {
      const closed = sale.status === "closed" || sale.effectiveEndTime <= now;
      const upcoming = !closed && sale.startTime > now;
      return {
        kind: "sale",
        saleTitle: sale.title,
        lotCount: sale.lotCount,
        sub: closed ? `${String(sale.soldCount ?? 0)} sold` : "Online",
        timeLabel: closed ? "Closed" : upcoming ? "Opens" : "Closes",
        timestamp: upcoming ? sale.startTime : sale.effectiveEndTime,
        tiles: [tiles[0], tiles[1], tiles[2]],
      };
    }
  }
  if (loaded.kind === "home" && loaded.data) {
    const sale = loaded.data;
    const photo = (await preparePhoto(sale.imageUrl)) ?? undefined;
    const live = sale.phase === "live";
    return {
      kind: "home",
      live,
      rightLabel: live ? sale.title : "Next sale opens",
      timestamp: live ? sale.effectiveEndTime : sale.startTime,
      photo,
    };
  }
  return { kind: "home", live: false, rightLabel: "" };
}

/**
 * Reads the fonts the cards use.
 *
 * @returns Font definitions for Satori
 */
async function loadFonts() {
  const dir = path.join(process.cwd(), "api/_fonts");
  const load = (file: string) => readFile(path.join(dir, file));
  const [lora600, inter500, inter600, inter700] = await Promise.all([
    load("lora-latin-600-normal.woff"),
    load("inter-latin-500-normal.woff"),
    load("inter-latin-600-normal.woff"),
    load("inter-latin-700-normal.woff"),
  ]);
  return [
    {
      name: "Lora",
      data: lora600,
      weight: 600 as const,
      style: "normal" as const,
    },
    {
      name: "Inter",
      data: inter500,
      weight: 500 as const,
      style: "normal" as const,
    },
    {
      name: "Inter",
      data: inter600,
      weight: 600 as const,
      style: "normal" as const,
    },
    {
      name: "Inter",
      data: inter700,
      weight: 700 as const,
      style: "normal" as const,
    },
  ];
}

/**
 * Renders a share image (1200x630 JPEG under about 290 KB).
 *
 * @param request - The incoming request (`kind`, `id`, optional cache key `v`)
 * @returns The JPEG response
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const raw = url.searchParams.get("kind");
  const kind: ShareKind = raw === "lot" || raw === "sale" ? raw : "home";
  const now = roundToMinute(Date.now());
  let loaded: LoadedShare;
  try {
    loaded = await loadShare(kind, url.searchParams.get("id"), now);
  } catch {
    loaded = { kind: "home", data: null };
  }
  const card = await buildCard(loaded, now);
  const png = await new ImageResponse(renderOgCard(card), {
    width: 1200,
    height: 630,
    fonts: await loadFonts(),
  }).arrayBuffer();
  let jpeg = await sharp(Buffer.from(png))
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  if (jpeg.byteLength > JPEG_BUDGET_BYTES) {
    jpeg = await sharp(Buffer.from(png))
      .jpeg({ quality: 65, mozjpeg: true })
      .toBuffer();
  }
  // Only a card that matches what the share page promised may be cached for
  // good; a fallback card must expire so the real one can replace it.
  const v = url.searchParams.get("v");
  const complete = loaded.data !== null && card.kind === kind;
  const cache =
    complete && v !== null && VERSION_KEY.test(v)
      ? "public, max-age=604800, s-maxage=31536000, immutable"
      : "public, s-maxage=300";
  return new Response(new Uint8Array(jpeg), {
    status: 200,
    headers: { "Content-Type": "image/jpeg", "Cache-Control": cache },
  });
}
