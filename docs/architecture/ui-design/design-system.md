# AgriBid design system

The single reference for how AgriBid looks and is built. Source of truth for values is `src/index.css`; for behaviour it is the components in `src/components/ui/` (shadcn primitives) and `src/components/ds/` (domain components). A live, dev-only reference page renders all of it: run `bun run dev` and open `/design-system` (not registered in production builds). Decision record: [ADR 0015](../../decisions/0015-design-system.md). Design intent and the three redesigned screens: `conductor/tracks/improve-screen-mockups/`.

Rules of use, in one line each:

- Use theme tokens, never hard-coded colours or fonts (`src/lib/theme-tokens.test.ts` fails on Tailwind palette classes).
- Every text/background pair must pass WCAG AA (4.5:1) in light and dark.
- Status is never shown by colour alone: always an icon or text too.
- Prefer flat sections and dividers to cards; never put a card in a card.

## 1. Tokens

Tokens are HSL triples in `:root` (light) and `.dark`, exposed to Tailwind through `@theme` as `--color-*`. Use them as `bg-card`, `text-muted-foreground`, `border-border`, and so on. Values below are for orientation; `index.css` wins if they differ.

| Group    | Tokens                                                                         | Notes                                                                                                    |
| -------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Surfaces | `background`, `card`, `popover`, `muted`, `border`, `input`                    | Warm cream page, white cards in light; near-black green-grey in dark                                     |
| Text     | `foreground`, `muted-foreground`                                               | `muted-foreground` is for secondary text and passes AA on `background`, `card`, `muted`                  |
| Brand    | `primary`, `primary-foreground`, `primary-soft`, `secondary`, `accent`         | Forest green; `secondary` is earth brown (darkened to pass AA); `primary-soft` is a tint for chips       |
| Buttons  | `btn`, `btn-foreground`                                                        | Filled buttons: the same green family in both themes, light text                                         |
| Hero     | `hero`, `hero-foreground`, `hero-muted`                                        | Dark green band for the home hero                                                                        |
| Status   | `live`, `soon`, `urgent`, `sold`, `passed`, each with `-solid`, `-soft`, `-fg` | `-solid` = badge fill with white text; `-soft` = pill background; `-fg` = text on `-soft` or on the page |
| Feedback | `ok-fg`, `warn-fg`, `destructive`, `success`, `warning`                        | Use `ok-fg` / `warn-fg` for text; `destructive` for errors and destructive actions                       |
| Focus    | `ring`                                                                         | Focus ring colour; lifted in dark so it clears both the page and filled buttons                          |
| Charts   | `chart-1` to `chart-5`                                                         | Data visualisation only                                                                                  |

Status meaning: `live` (bidding open), `soon` (opens later, or closing within 24h), `urgent` (closing within 1h), `sold`, `passed` (passed in / unsold).

Contrast is proven in `src/lib/theme-tokens.test.ts` for every pair, including the focus ring (3:1 against the page background, and against `btn` in dark). The `/design-system` page shows each pair's ratio in the current theme.

## 2. Type

- **Lora** (`font-display`): `h1` to `h3` (applied globally, weight 600), the hero, and prices on the lot page.
- **Inter** (`font-sans`): everything else.
- **Numbers**: money, counts and times use the `num` utility (tabular figures). Never use a monospace font for timers.

| Role            | Size (px) | Class hint                                                                                       |
| --------------- | --------- | ------------------------------------------------------------------------------------------------ |
| Eyebrow         | 12        | `text-xs uppercase tracking-wide`                                                                |
| Meta            | 13        | `text-[13px]` (the smallest text; nothing below 13px on a control or label that carries meaning) |
| Secondary       | 14        | `text-sm`                                                                                        |
| Body            | 15        | `text-[15px]`                                                                                    |
| Lead            | 17        | `text-[17px]`                                                                                    |
| Section (h3/h2) | 22        | `text-[22px]`                                                                                    |
| h2              | 26 to 28  | `text-[28px]`                                                                                    |
| h1              | 36        | `text-4xl`                                                                                       |

Body copy is 15px. 12px is only for uppercase eyebrows and badge text.

## 3. Spacing, radius, elevation

- **Spacing** follows a 4px rhythm (Tailwind's default scale). Section gaps are 32 to 40px on desktop, 24px on phone.
- **Radius**: `rounded-sm` 4px (badges, pills, chips), `rounded-md` 6px (buttons, inputs, panels), `rounded-lg` 8px (images and avatars only). Do not use `rounded-xl`/`rounded-2xl` on containers or buttons. Pills are `rounded-sm`, not fully round.
- **Elevation**: separate with borders and dividers, not shadows. No glows on buttons. Reserve shadows for floating layers (menus, dialogs).
- **Tap targets**: 44px minimum below `md`. `Button` default, `sm`, `lg` and `icon` are 44px on phone; `size="touch"` is always 44px.

## 4. Breakpoints

Mobile first. Unprefixed classes are the phone layout (design at 375x812). Then `md:` (768px, tablet) and `lg:` (1024px, desktop; check 1440x900). There are no custom breakpoints.

## 5. Components

### shadcn primitives (`src/components/ui/`)

`Button` (variants incl. `default` using the `btn` token; sizes incl. `touch`), `Badge` (variants incl. status `live | soon | urgent | sold | passed`), `Input`, `Tabs`, `Card`. Use `Button` for actions and `asChild` with a `Link` for navigation. Use `Badge` for generic labels; use `StatusBadge` for auction and lot status. `Card` is rarely needed: prefer a flat section with a divider.

### Domain components (`src/components/ds/`)

All have JSDoc and tests. Import from the file (`@/components/ds/Money`).

| Component          | Use it for                                                                                                                                                                                                                                | Don't use it for                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `StatusBadge`      | The one status of an auction or lot: ● Live, Opens {date}, Closing soon (urgent in the last hour), Sold, Passed in. Solid on photos, soft on plain surfaces. Derive the status with `deriveDisplayStatus` in `src/lib/auction-badges.ts`. | Generic tags, admin workflow states (use `Badge`) |
| `ReservePill`      | Reserve met / Reserve not met / No reserve, with icon and text                                                                                                                                                                            | Ended lots                                        |
| `Money`            | Every price: `R 200 000`, no cents, optional label (Opening bid / Current bid / Sold for) and "excl. VAT"                                                                                                                                 | Statements that need cents (use `formatCurrency`) |
| `Countdown`        | Time remaining (neutral, amber under 1h, red under 2 min) or the absolute SAST time with `absolute`                                                                                                                                       | Elapsed time, or a date range                     |
| `PhotoFrame`       | One photo at 16:9 or 4:3, cover-fit, lazy, required alt, branded empty state                                                                                                                                                              | Photos that must show uncropped (documents)       |
| `EventMosaic`      | A 16:9 event image: one large and two small photos; degrades for 0 to 2 photos                                                                                                                                                            | Lot photos                                        |
| `SaleTerms`        | Platform-wide terms: EFT within 48 hours, viewing by appointment, collection within 7 days, buyer's premium and VAT from props, "Full auction rules" link. Rows with no value are hidden.                                                 | Per-lot conditions of sale                        |
| `SpecTable`        | Key/value specifications as a `<dl>`; empty values are dropped                                                                                                                                                                            | Tabular data with many columns (use `Table`)      |
| `ConditionReport`  | Condition rows with icon and text (Good, Wear noted, Not reported), seller notes and an optional PDF link                                                                                                                                 | Marketing copy                                    |
| `SectionHeader`    | An h2 with right-aligned controls on a shared baseline                                                                                                                                                                                    | Page titles (use an `h1`)                         |
| `SegmentedControl` | A single choice that switches the view of one list; radiogroup with arrow keys; 44px on phone                                                                                                                                             | Navigation between pages (use links or tabs)      |
| `FilterChips`      | Active filters as removable chips plus "Clear filters"                                                                                                                                                                                    | Choosing filters (that is the sidebar or sheet)   |
| `StickyActionBar`  | One primary action pinned to the bottom of a long phone page; safe-area padding; hidden from `md`                                                                                                                                         | Desktop layouts; more than one or two actions     |

Notes:

- `StatusBadge`: pass the outcome (sold / passed) to `deriveDisplayStatus` for closed lots; with no outcome an ended lot reads "Passed in".
- `Countdown` ticks every second; a `className` text colour (e.g. `text-white` on a photo overlay) overrides the tone colour. The older `CountdownTimer` is kept for existing callers and delegates to `Countdown`; new code uses `Countdown`.
- Pages that use `StickyActionBar` add bottom padding (about 5rem) to the page, and must also keep the app footer reachable (the bar is fixed over it on phone). Standalone links in components have a 44px tap area on phone.

### Formatters

- `formatRand(n)` in `src/lib/currency.ts`: `R 200 000`, whole rand, narrow no-break spaces (U+202F) so a price never wraps. Use it for display. `formatCurrency` keeps cents for statements.
- `formatSastDate(ms)` in `src/lib/dates.ts`: `Sat 22 Nov, 10:00 SAST`, Africa/Johannesburg (UTC+2, no daylight saving), no seconds.

## 6. Content rules

- **Money**: `R 200 000`, no cents. Labels: Opening bid, Current bid, Sold for. Add "excl. VAT" where VAT is not included.
- **Dates and times**: `Sat 22 Nov, 10:00 SAST`. No seconds, no ISO strings, no raw timestamps. Countdowns may show seconds.
- **Language**: plain South African English ("tyres", "colour", "metre"). Say "about", not "est." No jargon, no internal states, no database ids in the UI.
- **Labels**: sentence case. Buttons say what happens ("Place bid", "View lots"). Use "Sell equipment" for the seller entry point.
- **Unknowns**: hide a row rather than show "N/A" or a made-up value (company registration number, response time, VAT rate).
- **Numbers** that are shown as a count (lots, results) must match what the user can see.

## 7. Imagery

- Events 16:9 with a three-photo mosaic from the lead lots; lots and galleries 4:3.
- `object-fit: cover`, 8px radius, lazy loading (eager only for the above-the-fold hero).
- Labelled angles in galleries: Front, Engine, Cab, Rear. The gallery counter is the real photo count.
- A missing photo shows the branded empty state, never a broken image or a stock photo.
- Every image has meaningful alt text; decorative images use `alt=""`.

## 8. Accessibility checklist

- [ ] Every text/background pair is AA (4.5:1); non-text UI (focus ring, icons that carry meaning) is 3:1.
- [ ] Status and condition are shown with an icon and text, not colour alone.
- [ ] `:focus-visible` shows a 2px ring with a 2px offset on every interactive element, in both themes.
- [ ] Tap targets are at least 44px below `md`.
- [ ] Semantic HTML: one `h1`, ordered headings, `<dl>` for key/value, `<button>` for actions and `<a>` for navigation.
- [ ] Controls have accessible names; groups have a label (`radiogroup`, `group`).
- [ ] Keyboard: everything reachable and operable; arrow keys in the segmented control.
- [ ] Motion is minimal; nothing pulses or flashes.
- [ ] Layout works at 375, 768 and 1440 with no horizontal scroll, and with text zoomed to 200%.
- [ ] Both themes checked.

## 9. Adding to the system

1. Add or change a token in `src/index.css` (both themes), expose it in `@theme`, add its contrast pair to `src/lib/theme-tokens.test.ts`.
2. Add a component in `src/components/ds/` (PascalCase, JSDoc, tests for success and edge cases), then show it in `src/pages/DesignSystem.tsx`.
3. Document it in the table above (use it for, don't use it for).
