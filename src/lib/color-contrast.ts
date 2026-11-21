/** An HSL colour as `[hue, saturation %, lightness %]`. */
export type Hsl = readonly [number, number, number];

/**
 * Reads the `--name: H S% L%` declarations of one theme block of a CSS file.
 *
 * @param css - The CSS source (e.g. `src/index.css`)
 * @param selector - The block to read: `:root` (light) or `.dark`
 * @returns Map of token name (without `--`) to its HSL triple
 */
export function readHslTokens(
  css: string,
  selector: ":root" | ".dark"
): Map<string, Hsl> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Missing ${selector} block`);
  const end = css.indexOf("}", start);
  const block = css.slice(start, end);
  const tokens = new Map<string, Hsl>();
  for (const m of block.matchAll(
    /--([a-z0-9-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/g
  )) {
    const [, name, h, s, l] = m;
    if (name && h && s && l) {
      tokens.set(name, [Number(h), Number(s), Number(l)]);
    }
  }
  return tokens;
}

/**
 * Converts HSL to RGB channels in 0..1.
 *
 * @param color - The HSL colour
 * @returns The `[r, g, b]` channels
 */
function toRgb(color: Hsl): [number, number, number] {
  const [h, s, l] = color;
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

/**
 * WCAG relative luminance of a colour.
 *
 * @param color - The HSL colour
 * @returns Relative luminance, 0 (black) to 1 (white)
 */
export function luminance(color: Hsl): number {
  const [r = 0, g = 0, b = 0] = toRgb(color).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two colours.
 *
 * @param a - First colour
 * @param b - Second colour
 * @returns Ratio from 1 to 21
 */
export function contrastRatio(a: Hsl, b: Hsl): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
