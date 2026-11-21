# Review round 8: scores

Not every item is at 9 yet. Seven items are at 9 and three are at 8. None of the 8s is structural; each comes from one specific, cheap defect.

All six round-7 fixes landed:

- The desktop terms grid is back to a clean 3×2 (`grid-column:auto` at ≥760px), and phone keeps Reserve full-width.
- The phone condition actions are two equal full-width 44px buttons.
- The Fendt now reads "Reserve not met" at R 2 650 000.
- The registered pre-start hint branches when the max equals the opening bid. Its new wording introduces a new error, though (see fix 1).
- "below as PDF" is kept together.
- The Fendt now leads with `fendt-cabin.jpeg` on the card, the mosaic and the rail. That swap introduces the imagery problem in fix 3.

How I checked:

- Chrome at 1440, light and dark. I expanded `#app-d` and `#app-m` to their full scroll height and took full-height captures, then also scrolled the real frames.
- All 4 lot states on both frames and in both themes.
- Desktop Detailed and Compact.
- The phone filter sheet, opened mid-list: toggled Fendt, checked "Show 1 lot", then the chips and Clear filters.
- The board under emulation at 390×844×3 with mobile and touch.

Measured results:

- **Contrast:** a script composited every text node over its painted background stack, and over both white and black wherever a photo sits underneath. It covered 3 tabs, 4 lot states and 2 themes, and found 0 failures. For the hero H1 I checked the overlay gradient by hand: the phone H1 sits at about 0.65 overlay alpha, about 4.6:1 over white sky, and it's large text.
- **Tap targets in `#app-m`:** the only misses are the two filter-sheet range inputs at 341×32. The `.stretch` title links are covered by a full-card `::after`, and the field labels are paired with ≥44px inputs.
- **Overflow:** frame overflow is 0 on every tab and state. No `scrollWidth > clientWidth` on any button, badge, price, heading or cell. Document overflow at 390 is 0.
- **Images:** all load.
- **Console:** empty.
- **Headings:** start at h1 with no skipped levels on all 6 frame/tab combinations.
- **Sticky bar:** the label, price, countdown and CTA match the panel in all 4 states. It is 76px tall with a 44px CTA, and sits flush with the frame bottom.
- **Fee maths:**
  - Live: R 3 975 000 + R 198 750 + R 626 063 = R 4 799 813.
  - Pre-start: R 1 450 000 + R 72 500 + R 228 375 = R 1 750 875.
- **Prices and times agree across tabs:**
  - Card "Bid R 3 975 000" = lot CTA.
  - "From R 2 650 000" = Fendt.
  - MF R 2 150 000 closes in 42m = 06:30.
  - NH opens in 4d 3h 12m = Mon 24 Nov, 09:00.
  - First lot closes in 2d 4h 12m = Sat 22 Nov, 10:00.
- **Photo sources:** `fendt-cabin.jpeg` is **350×220**. It renders at 290–394 CSS px, so it is upscaled even at 1×, and at about 2.3× on a 3× phone. Every other photo in use is ≥1366px wide.

| #   | Item                            | Score | Justification                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visual hierarchy & scannability | 9/10  | Status, countdown, price and CTA lead on every screen and state. The bid panel reads in decision order, and the event header, terms and countdown card are in the right order again.                                                                                                                                |
| 2   | Brand & premium feel            | 9/10  | Forest/warm tokens, Lora/Inter with tabular figures, 4–6px UI radii and 8px images. Flat sections, no card-in-card, and a dark mode that looks designed. The restored terms grid removes last round's cheap look.                                                                                                   |
| 3   | Trust & transparency            | 9/10  | Premium, VAT, reserve, payment, collection, viewing, inspection date plus PDF, seller verification and bid record all sit at the decision point. The fee maths is exact. Nits: the NH report marks Tyres "Wear noted" for "Rear 70%, even wear", and the board note describes a watermark that is no longer shown.  |
| 4   | Conversion clarity              | 9/10  | One state-correct CTA per lot and state, and the sticky bar agrees in all 4. The filter sheet ends in "Show N lots". The pre-start hint copy undercuts the CTA (scored under #8).                                                                                                                                   |
| 5   | Mobile UX (375px)               | 8/10  | Two measured misses. The filter-sheet range sliders are 32px tall, which breaks the ≥44px rule. After "Show 1 lot" from mid-list, the list clamps to the bottom, and the "1 of 3 lots" count and active chips sit hidden under the sticky Filters/Sort bar (chip top 74px < bar bottom 108px).                      |
| 6   | Desktop layout & space          | 9/10  | Grids align to the header edge, the 3-up cards and 3×2 terms are tidy, and the sticky panel is right. Nit: Compact view is 2-up, so 3 lots leave an empty bottom-right cell, and "compact" is less dense than Detailed (big 44px CTA per row).                                                                      |
| 7   | Imagery                         | 8/10  | Real photos at consistent 16:9/4:3, no cross-lot reuse, and the mosaic matches the lots. But the Fendt's only photo is a 350×220 source stretched to 290–394px on all three screens. It is visibly soft next to the 1400px+ photos, and the board doesn't disclose it. It still claims a watermarked photo instead. |
| 8   | Copy & microcopy                | 8/10  | Labels, "R 3 950 000" and "Sat 22 Nov, 10:00 SAST" are right. But in the registered pre-start state the hint says "Bid the opening R 1 450 000 **now**…" directly under "Opens in 4d 3h 12m", which is factually wrong at the moment of commitment. Nit: "2021 John / Deere 8R 410" splits the make on phone.       |
| 9   | Accessibility & theming         | 9/10  | AA in both themes, including text over photos. Visible focus, status always carries a word plus an icon, the heading outline and DOM order are correct, and the sheet keeps focus. The 32px range inputs are counted under #5.                                                                                      |
| 10  | Craft & polish                  | 9/10  | No clipping, overflow or console errors, and components are consistent across screens. Nits: the phone "Full auction rules" link is unstyled bold text with no arrow, sitting above the facts, while desktop has a green link with an arrow at the end of the grid. The board note is stale.                        |

## Fixes, ordered by score impact

1. **Lot (registered, before start) · desktop + phone · light + dark · the hint says "Bid the opening R 1 450 000 now" while bidding opens in 4 days.**
   - At line 751, replace the `bid===l.bid` branch text with: `Your maximum is the opening bid. Raise it and, once bidding opens on Mon 24 Nov, we bid for you in ${R(25000)} steps, only as far as needed.`
   - Change the else branch to: `When bidding opens we bid for you in ${R(25000)} steps, only as far as needed, up to ${R(bid)}.`
2. **Event · phone · light + dark · the filter-sheet range sliders are 32px tall (below 44px).**
   - At line 354, change `.m-panel .rng{min-height:32px}` to `.m-panel .rng{min-height:44px}`.
   - Also give `.rng` a larger thumb: `.rng::-webkit-slider-thumb{width:24px;height:24px}` plus the `::-moz-range-thumb` equivalent, with `appearance:none` on both and a `--a-btn` background.
3. **Event + Home + Lot rail · desktop + phone · light + dark · the Fendt photo `fendt-cabin.jpeg` is 350×220 and is upscaled everywhere (soft), and the board doesn't say so.**
   - Pick one:
     - **(a)** Lead with `fendt-engine.jpeg` (640×480, native 4:3) and hide the bottom-right watermark with `object-position:30% 20%` plus `transform:scale(1.18);transform-origin:20% 20%` on that image only. Add an `imgs` entry with `pos:"30% 20%"` and a per-image `zoom` class.
     - **(b)** Keep `fendt-cabin` and disclose it. Append to the `.compare` note (line 817): "The only Fendt photo is 350×220 and shows soft on large and high-DPI screens; a seller re-shoot is requested."
   - Either way, replace the now-false sentence "one carries a third-party watermark and should be retaken" (unless you choose (a)).
4. **Event · phone · light + dark · after "Show N lots" from mid-list, the "N of 3 lots" count and the filter chips are hidden under the sticky `.m-bar`.**
   - In `act()`, when `a==="close"`, after `paint(true…)` run: `const m=document.getElementById("app-m"),h=m.querySelector(".res-count, .chips")?.closest("div");if(h)m.scrollTop=h.offsetTop-m.querySelector(".m-bar").offsetHeight-56-8;`. Use the actual wrapper class of the count/chip row.
   - Also add `scroll-margin-top:120px` to that wrapper.
5. **Event · phone · light + dark · the "Full auction rules" link looks like bold body text and sits above the facts.**
   - Move `<a class="link rules-m">` (line 680) out of `.when` to directly after the terms `<dl>`.
   - Give it the same arrow as desktop: `Full auction rules ${ic("arrow")}`.
   - Add `.app .rules-m{min-height:44px;align-items:center;gap:6px;color:var(--a-link)}`, the same token as the desktop `.terms .rules` link.
6. **Event · desktop · light + dark · Compact view leaves an empty grid cell with 3 lots and is less dense than Detailed.**
   - Make desktop compact a single-column list:
     - `@container (min-width:760px){.lots.compact{grid-template-columns:1fr}}`
     - Put the CTA inline at the right of each row: `.lot.row{grid-template-columns:160px 1fr auto}`, with `.lot.row .btn.block{width:auto;min-width:200px;align-self:center}`.
   - Alternatively, use `repeat(3,1fr)` so 3 lots fill one row.
7. **Lot (pre-start, NH) · all · both · the condition row contradicts itself: Tyres "Wear noted" with "Rear 70%, even wear".**
   - At line 713, either change the status to `"ok"` ("Good"), or keep "wear" and make the detail specific: `"Rear 70%, front 75%; replace rears within a season"`.
8. **Event · phone · light + dark · the compact title wraps as "2021 John / Deere 8R 410".**
   - In the title formatter that already binds the model number, also bind multi-word makes: `title.replace("John Deere","John Deere").replace("Massey Ferguson","Massey Ferguson").replace("New Holland","New Holland")`.
   - With balance, that wraps as "2021 John Deere / 8R 410".
9. **Home · desktop · light + dark · nit: event-card meta is inconsistent.** Card 2 puts the region and "3 lots · From…" on two lines, while cards 1 and 3 use one line.
   - Always render the region on its own line and "N lots · Current/Opening/From R …" on the next, with `.ev-meta{display:grid;gap:2px}`, so all three cards share one rhythm.
