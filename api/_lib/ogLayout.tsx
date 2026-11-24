import type { CSSProperties, ReactElement } from "react";

import { formatSastDate } from "../../src/lib/dates.js";

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
 * Font size of a sale title in the band: 58px up to 18 characters, else 44px.
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
 * One column of the band, vertically centred.
 *
 * @param props - Position and children
 * @param props.left - Left offset (omit for right-anchored)
 * @param props.right - Right offset
 * @param props.width - Column width
 * @param props.gap - Gap between children
 * @param props.align - Text alignment
 * @param props.children - Column content
 * @returns The column element
 */
function Column({
  left,
  right,
  width,
  gap,
  align,
  children,
}: {
  left?: number;
  right?: number;
  width: number;
  gap: number;
  align?: "flex-end";
  children: ReactElement | (ReactElement | null)[];
}): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        top: 420,
        height: 210,
        ...(left === undefined ? {} : { left }),
        ...(right === undefined ? {} : { right }),
        ...(align === undefined ? {} : { alignItems: align }),
        width,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A single-line text run with an ellipsis.
 *
 * @param props - Text style
 * @param props.text - The text
 * @param props.style - Extra style
 * @returns The element
 */
function Line({
  text,
  style,
}: {
  text: string;
  style: CSSProperties;
}): ReactElement {
  return (
    <div
      style={{
        display: "block",
        maxWidth: "100%",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: "#fff",
        ...style,
      }}
    >
      {text}
    </div>
  );
}

/**
 * The wordmark.
 *
 * @param props - Size
 * @param props.size - Font size in px
 * @returns The element
 */
function Wordmark({ size }: { size: number }): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: "Lora",
        fontWeight: 600,
        fontSize: size,
        color: CREAM,
      }}
    >
      AgriBid
    </div>
  );
}

/**
 * The right column: a label and the date and time on two lines.
 *
 * @param props - Label and time
 * @param props.label - Label above the date
 * @param props.timestamp - The time shown, if any
 * @returns The element
 */
function RightColumn({
  label,
  timestamp,
}: {
  label: string;
  timestamp?: number;
}): ReactElement {
  const { date, time } =
    timestamp === undefined ? { date: "", time: "" } : splitDateTime(timestamp);
  return (
    <Column left={910} width={250} gap={4} align="flex-end">
      <Line
        text={label}
        style={{
          fontFamily: "Inter",
          fontWeight: 500,
          fontSize: 28,
          color: MUTED,
          textAlign: "right",
        }}
      />
      {date ? (
        <Line
          text={date}
          style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 36 }}
        />
      ) : null}
      {time ? (
        <Line
          text={time}
          style={{ fontFamily: "Inter", fontWeight: 700, fontSize: 36 }}
        />
      ) : null}
    </Column>
  );
}

/**
 * The photo area: blurred backdrop plus the sharp photo.
 *
 * @param props - The photo
 * @param props.photo - Prepared photo
 * @returns The element
 */
function PhotoArea({ photo }: { photo: OgPhoto }): ReactElement {
  return (
    <div style={{ ...fill, width: 1200, height: 420 }}>
      <img src={photo.bg} width={1200} height={420} style={fill} />
      <img
        src={photo.fg}
        width={720}
        height={420}
        style={{ ...fill, left: 240 }}
      />
    </div>
  );
}

/**
 * Renders the 1200x630 card.
 *
 * @param card - What to show
 * @returns A Satori-compatible element tree
 */
export function renderOgCard(card: OgCard): ReactElement {
  return (
    <div
      style={{
        ...fill,
        width: 1200,
        height: 630,
        background: CANVAS,
        fontFamily: "Inter",
      }}
    >
      {card.kind === "lot" ? <LotBody card={card} /> : null}
      {card.kind === "sale" ? <SaleBody card={card} /> : null}
      {card.kind === "home" ? <HomeBody card={card} /> : null}
    </div>
  );
}

/**
 * Lot card: photo, chips, title and price.
 *
 * @param props - The card
 * @param props.card - Lot card data
 * @returns The element
 */
function LotBody({
  card,
}: {
  card: Extract<OgCard, { kind: "lot" }>;
}): ReactElement {
  return (
    <>
      <PhotoArea photo={card.photo} />
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 32,
          display: "flex",
          gap: 12,
        }}
      >
        {card.lotNumber === undefined ? null : (
          <div style={{ ...chipBase, background: "rgba(20,23,20,0.92)" }}>
            {`Lot ${String(card.lotNumber)}`}
          </div>
        )}
        {card.sold ? (
          <div style={{ ...chipBase, background: "#1D56A5" }}>Sold</div>
        ) : null}
      </div>
      <Column left={40} width={230} gap={0}>
        <Wordmark size={44} />
      </Column>
      <Column left={307} width={590} gap={14}>
        <Line
          text={card.title}
          style={{ fontFamily: "Lora", fontWeight: 600, fontSize: 58 }}
        />
        <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Inter",
              fontWeight: 500,
              fontSize: 34,
              color: MUTED,
            }}
          >
            {card.priceLabel}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Inter",
              fontWeight: 700,
              fontSize: 54,
              color: "#fff",
            }}
          >
            {card.price}
          </div>
        </div>
      </Column>
      <RightColumn label={card.timeLabel} timestamp={card.timestamp} />
    </>
  );
}

/**
 * Sale card: three-photo collage, sale title and lot count.
 *
 * @param props - The card
 * @param props.card - Sale card data
 * @returns The element
 */
function SaleBody({
  card,
}: {
  card: Extract<OgCard, { kind: "sale" }>;
}): ReactElement {
  const [a, b, c] = card.tiles;
  return (
    <>
      <img src={a} width={640} height={420} style={fill} />
      <img src={b} width={556} height={208} style={{ ...fill, left: 644 }} />
      <img
        src={c}
        width={556}
        height={208}
        style={{ ...fill, left: 644, top: 212 }}
      />
      <Column left={40} width={230} gap={0}>
        <Wordmark size={44} />
      </Column>
      <Column left={307} width={590} gap={14}>
        <div
          style={{
            display: "flex",
            maxWidth: "100%",
            overflow: "hidden",
            fontFamily: "Lora",
            fontWeight: 600,
            fontSize: saleTitleSize(card.saleTitle),
            lineHeight: 1.1,
            color: "#fff",
          }}
        >
          {card.saleTitle}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Inter",
              fontWeight: 700,
              fontSize: 54,
              color: "#fff",
            }}
          >
            {`${String(card.lotCount)} lots`}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Inter",
              fontWeight: 500,
              fontSize: 34,
              color: MUTED,
            }}
          >
            {card.sub}
          </div>
        </div>
      </Column>
      <RightColumn label={card.timeLabel} timestamp={card.timestamp} />
    </>
  );
}

/**
 * Home card: photo (or brand green with the wordmark), "AgriBid" and the live
 * sale's close time.
 *
 * @param props - The card
 * @param props.card - Home card data
 * @returns The element
 */
function HomeBody({
  card,
}: {
  card: Extract<OgCard, { kind: "home" }>;
}): ReactElement {
  return (
    <>
      {card.photo ? (
        <PhotoArea photo={card.photo} />
      ) : (
        <div
          style={{
            ...fill,
            width: 1200,
            height: 420,
            background: BRAND,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Wordmark size={150} />
        </div>
      )}
      <Column left={40} width={230} gap={10}>
        <Wordmark size={44} />
        {card.live ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                display: "flex",
                width: 16,
                height: 16,
                borderRadius: 8,
                background: "#3CDD77",
              }}
            />
            <div
              style={{
                display: "flex",
                fontFamily: "Inter",
                fontWeight: 600,
                fontSize: 30,
                color: "#fff",
              }}
            >
              Live now
            </div>
          </div>
        ) : null}
      </Column>
      {card.photo ? (
        <Column left={307} width={590} gap={0}>
          <Line
            text="AgriBid"
            style={{ fontFamily: "Lora", fontWeight: 600, fontSize: 84 }}
          />
        </Column>
      ) : null}
      <RightColumn label={card.rightLabel} timestamp={card.timestamp} />
    </>
  );
}
