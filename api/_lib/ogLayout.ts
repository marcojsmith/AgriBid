import { createElement, type CSSProperties, type ReactElement } from "react";

import { formatSastDate } from "../../src/lib/dates.js";

// No JSX here on purpose: Vercel only compiles `.ts` helpers next to a
// function entry, so a `.tsx` file in `api/_lib` is never emitted as `.js`.

/** Canvas background and the brand green used where a photo would be. */
const CANVAS = "#1D3928";
const BRAND = "#2D533B";
const CREAM = "#FBFAF8";
const MUTED = "#D6E0DA";

/** A photo prepared for the card: sharp foreground and blurred backdrop. */
export interface OgPhoto {
  /** 720x420 data URI. */
  fg: string;
  /** 1200x420 blurred data URI. */
  bg: string;
}

/** What a card shows. */
export type OgCard =
  | {
      kind: "lot";
      title: string;
      lotNumber?: number;
      sold: boolean;
      priceLabel: string;
      price: string;
      timeLabel: string;
      timestamp?: number;
      photo: OgPhoto;
    }
  | {
      kind: "sale";
      saleTitle: string;
      lotCount: number;
      sub: string;
      timeLabel: string;
      timestamp: number;
      /** Three 640x420, 556x208, 556x208 data URIs. */
      tiles: [string, string, string];
    }
  | {
      kind: "home";
      live: boolean;
      rightLabel: string;
      timestamp?: number;
      photo?: OgPhoto;
    };

/** Which card to draw once we know what photos are available. */
export type CardKind = "lot" | "sale" | "home";

/**
 * Splits a timestamp into the two right-column lines: "Wed 25 Nov" and "11:00".
 *
 * @param timestamp - Milliseconds since the epoch
 * @returns The date and time lines (both empty for a non-finite input)
 */
export function splitDateTime(timestamp: number): {
  date: string;
  time: string;
} {
  const [date = "", time = ""] = formatSastDate(timestamp)
    .split(",")
    .map((part) => part.trim());
  return { date, time };
}

/**
 * Font size of a lot or sale title in the band: 58px up to 18 characters,
 * else 44px.
 *
 * @param title - The sale title
 * @returns The size in px
 */
export function saleTitleSize(title: string): number {
  return title.length <= 18 ? 58 : 44;
}

/**
 * Picks the card to draw. A card that needs photos it does not have falls back
 * to the photo-free home card.
 *
 * @param wanted - The kind the URL asked for
 * @param photoCount - How many usable photos were fetched
 * @returns The kind to draw
 */
export function chooseCardKind(wanted: CardKind, photoCount: number): CardKind {
  if (wanted === "sale") return photoCount >= 3 ? "sale" : "home";
  if (wanted === "lot") return photoCount >= 1 ? "lot" : "home";
  return "home";
}

type Child = ReactElement | string | null | false;

/**
 * Builds a Satori element.
 *
 * @param type - Tag name
 * @param style - Inline style
 * @param children - Child elements or text
 * @returns The element
 */
function el(
  type: "div" | "img",
  style: CSSProperties,
  ...children: Child[]
): ReactElement {
  const kids = children.filter(
    (child): child is ReactElement | string => child !== null && child !== false
  );
  return createElement(type, { style }, ...kids);
}

/**
 * An image element.
 *
 * @param src - Data URI
 * @param width - Width in px
 * @param height - Height in px
 * @param style - Extra style
 * @returns The element
 */
function img(
  src: string,
  width: number,
  height: number,
  style: CSSProperties
): ReactElement {
  return createElement("img", { src, width, height, style });
}

const fill: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  display: "flex",
};

const chipBase: CSSProperties = {
  display: "flex",
  fontFamily: "Inter",
  fontWeight: 700,
  fontSize: 30,
  lineHeight: 1,
  color: "#fff",
  padding: "10px 18px",
  borderRadius: 6,
};

/**
 * One column of the band, vertically centred. Only defined style keys are
 * set: the Satori version bundled in `@vercel/og` throws on `undefined`.
 *
 * @param opts - Position and size
 * @param opts.left - Left offset
 * @param opts.width - Column width
 * @param opts.gap - Gap between children
 * @param opts.alignEnd - Right-align the children
 * @param children - Column content
 * @returns The column element
 */
function column(
  opts: { left: number; width: number; gap: number; alignEnd?: boolean },
  ...children: Child[]
): ReactElement {
  return el(
    "div",
    {
      position: "absolute",
      top: 420,
      height: 210,
      left: opts.left,
      width: opts.width,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: opts.gap,
      ...(opts.alignEnd ? { alignItems: "flex-end" } : {}),
    },
    ...children
  );
}

/**
 * A single-line text run with an ellipsis.
 *
 * @param text - The text
 * @param style - Extra style
 * @returns The element
 */
function line(text: string, style: CSSProperties): ReactElement {
  return el(
    "div",
    {
      display: "block",
      maxWidth: "100%",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      color: "#fff",
      ...style,
    },
    text
  );
}

/**
 * The wordmark.
 *
 * @param size - Font size in px
 * @returns The element
 */
function wordmark(size: number): ReactElement {
  return el(
    "div",
    {
      display: "flex",
      fontFamily: "Lora",
      fontWeight: 600,
      fontSize: size,
      color: CREAM,
    },
    "AgriBid"
  );
}

/**
 * The right column: a label and the date and time on two lines.
 *
 * @param label - Label above the date
 * @param timestamp - The time shown, if any
 * @returns The element
 */
function rightColumn(label: string, timestamp?: number): ReactElement {
  const { date, time } =
    timestamp === undefined ? { date: "", time: "" } : splitDateTime(timestamp);
  const strong: CSSProperties = {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 36,
  };
  return column(
    { left: 910, width: 250, gap: 4, alignEnd: true },
    line(label, {
      fontFamily: "Inter",
      fontWeight: 500,
      fontSize: 28,
      color: MUTED,
      textAlign: "right",
    }),
    date ? line(date, strong) : null,
    time ? line(time, strong) : null
  );
}

/**
 * The photo area: blurred backdrop plus the sharp photo.
 *
 * @param photo - Prepared photo
 * @returns The element
 */
function photoArea(photo: OgPhoto): ReactElement {
  return el(
    "div",
    { ...fill, width: 1200, height: 420 },
    img(photo.bg, 1200, 420, fill),
    img(photo.fg, 720, 420, { ...fill, left: 240 })
  );
}

/**
 * A "label  value" row of the band.
 *
 * @param label - Smaller muted text
 * @param value - Larger text
 * @param labelFirst - Whether the label comes before the value
 * @returns The element
 */
function priceRow(
  label: string,
  value: string,
  labelFirst: boolean
): ReactElement {
  const muted = el(
    "div",
    {
      display: "flex",
      fontFamily: "Inter",
      fontWeight: 500,
      fontSize: 34,
      color: MUTED,
    },
    label
  );
  const strong = el(
    "div",
    {
      display: "flex",
      fontFamily: "Inter",
      fontWeight: 700,
      fontSize: 54,
      color: "#fff",
    },
    value
  );
  return el(
    "div",
    { display: "flex", alignItems: "baseline", gap: 18 },
    ...(labelFirst ? [muted, strong] : [strong, muted])
  );
}

/**
 * Lot card body: photo, chips, title and price.
 *
 * @param card - Lot card data
 * @returns The child elements
 */
function lotBody(card: Extract<OgCard, { kind: "lot" }>): Child[] {
  return [
    photoArea(card.photo),
    el(
      "div",
      { position: "absolute", top: 28, left: 32, display: "flex", gap: 12 },
      card.lotNumber === undefined
        ? null
        : el(
            "div",
            { ...chipBase, background: "rgba(20,23,20,0.92)" },
            `Lot ${String(card.lotNumber)}`
          ),
      card.sold
        ? el("div", { ...chipBase, background: "#1D56A5" }, "Sold")
        : null
    ),
    column({ left: 40, width: 230, gap: 0 }, wordmark(44)),
    column(
      { left: 307, width: 590, gap: 14 },
      line(card.title, {
        fontFamily: "Lora",
        fontWeight: 600,
        fontSize: saleTitleSize(card.title),
      }),
      priceRow(card.priceLabel, card.price, true)
    ),
    rightColumn(card.timeLabel, card.timestamp),
  ];
}

/**
 * Sale card body: three-photo collage, sale title and lot count.
 *
 * @param card - Sale card data
 * @returns The child elements
 */
function saleBody(card: Extract<OgCard, { kind: "sale" }>): Child[] {
  const [a, b, c] = card.tiles;
  return [
    img(a, 640, 420, fill),
    img(b, 556, 208, { ...fill, left: 644 }),
    img(c, 556, 208, { ...fill, left: 644, top: 212 }),
    column({ left: 40, width: 230, gap: 0 }, wordmark(44)),
    column(
      { left: 307, width: 590, gap: 14 },
      el(
        "div",
        {
          display: "flex",
          maxWidth: "100%",
          overflow: "hidden",
          fontFamily: "Lora",
          fontWeight: 600,
          fontSize: saleTitleSize(card.saleTitle),
          lineHeight: 1.1,
          color: "#fff",
        },
        card.saleTitle
      ),
      priceRow(card.sub, `${String(card.lotCount)} lots`, false)
    ),
    rightColumn(card.timeLabel, card.timestamp),
  ];
}

/**
 * Home card body: photo (or brand green with the wordmark), the wordmark with
 * "Live now", and the live sale's close time.
 *
 * @param card - Home card data
 * @returns The child elements
 */
function homeBody(card: Extract<OgCard, { kind: "home" }>): Child[] {
  const liveRow = el(
    "div",
    { display: "flex", alignItems: "center", gap: 10 },
    el("div", {
      display: "flex",
      width: 16,
      height: 16,
      borderRadius: 8,
      background: "#3CDD77",
    }),
    el(
      "div",
      {
        display: "flex",
        fontFamily: "Inter",
        fontWeight: 600,
        fontSize: 30,
        color: "#fff",
      },
      "Live now"
    )
  );
  return [
    card.photo
      ? photoArea(card.photo)
      : el(
          "div",
          {
            ...fill,
            width: 1200,
            height: 420,
            background: BRAND,
            alignItems: "center",
            justifyContent: "center",
          },
          wordmark(150)
        ),
    column(
      { left: 40, width: 230, gap: 10 },
      wordmark(44),
      card.live ? liveRow : null
    ),
    card.photo
      ? column(
          { left: 307, width: 590, gap: 0 },
          line("AgriBid", { fontFamily: "Lora", fontWeight: 600, fontSize: 84 })
        )
      : null,
    rightColumn(card.rightLabel, card.timestamp),
  ];
}

/**
 * Renders the 1200x630 card.
 *
 * @param card - What to show
 * @returns A Satori-compatible element tree
 */
export function renderOgCard(card: OgCard): ReactElement {
  let body: Child[];
  if (card.kind === "lot") body = lotBody(card);
  else if (card.kind === "sale") body = saleBody(card);
  else body = homeBody(card);
  return el(
    "div",
    {
      ...fill,
      width: 1200,
      height: 630,
      background: CANVAS,
      fontFamily: "Inter",
    },
    ...body
  );
}
