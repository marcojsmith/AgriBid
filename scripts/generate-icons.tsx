/**
 * One-off generator for the app icon set in `public/`: a cream Lora "A" on
 * brand green, full bleed. Satori turns the text into SVG paths (so the SVG
 * needs no font) and sharp rasterises the PNGs.
 *
 * Run: `bun scripts/generate-icons.tsx`. The outputs are committed.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import satori from "satori";

const GREEN = "#2D533B";
const CREAM = "#FBFAF8";
const LETTER_SCALE = 0.68;
const root = path.resolve(import.meta.dirname, "..");

type Weight = 600 | 700;

/**
 * Draws the icon as an SVG string.
 *
 * @param size - Edge length in px
 * @param weight - Lora weight
 * @returns The SVG markup
 */
async function iconSvg(size: number, weight: Weight): Promise<string> {
  const data = await readFile(
    path.join(root, `api/_fonts/lora-latin-${String(weight)}-normal.woff`)
  );
  return satori(
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        background: GREEN,
        color: CREAM,
        fontFamily: "Lora",
        fontWeight: weight,
        fontSize: size * LETTER_SCALE,
        lineHeight: 1,
      }}
    >
      A
    </div>,
    {
      width: size,
      height: size,
      fonts: [{ name: "Lora", data, weight, style: "normal" }],
    }
  );
}

/**
 * Writes a PNG of the icon at one size.
 *
 * @param file - Output file name inside `public/`
 * @param size - Edge length in px
 * @param weight - Lora weight
 */
async function writePng(
  file: string,
  size: number,
  weight: Weight
): Promise<void> {
  // Render the SVG large, then resample, so small sizes stay crisp.
  const svg = await iconSvg(512, weight);
  const png = await sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size)
    .png()
    .toBuffer();
  await writeFile(path.join(root, "public", file), png);
}

await writeFile(path.join(root, "public/favicon.svg"), await iconSvg(512, 700));
await writePng("favicon-32.png", 32, 700);
await writePng("favicon-16.png", 16, 700);
await writePng("apple-touch-icon.png", 180, 600);
await writePng("icon-192.png", 192, 600);
await writePng("icon-512.png", 512, 600);
