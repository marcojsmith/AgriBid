# Review round 9: scores

Not every item is at 9 yet. Eight items are at 9 and two are at 8. Both 8s are new and cheap to fix: focus rings clipped by `overflow` on three controls, and the new desktop Compact row, whose parts are scattered across the row.

All round-8 fixes landed:

- The registered pre-start hint now reads "Your maximum is the opening bid. Raise it and, once bidding opens on Mon 24 Nov…".
- The filter-sheet range inputs are 44px tall (measured 44/44).
- "Show 1 lot" returns to the list with "1 of 3 lots" and the chips in view: chips top 160px, sticky bar bottom 119px.
- The Fendt soft-photo disclosure is in the board note, and the false watermark sentence is gone.
- The phone "Full auction rules" link sits after the terms, with an arrow, at 44px.
- Desktop Compact is a one-column list.
- NH Tyres now reads "Good · Rear 70%, even wear".
- The make is bound, so the title wraps as "2021 John Deere / 8R 410".
- `.ev-meta` is a grid.

How I checked:

- Chrome at 1440, light and dark.
- Expanded `#app-d` and `#app-m` to their full scroll height and stepped through them, then scrolled the real frames.
- All 4 lot states on both frames and in both themes.
- Desktop Detailed and Compact.
- The phone filter sheet, opened mid-list: Fendt toggled, then "Show 1 lot" and Clear filters.
- The board under emulation at 390×844×3, mobile and touch.
- Keyboard focus forced (`focus({focusVisible:true})`) on every focusable control, with outline extents compared against the nearest clipping ancestor.

Measured results:

- **Contrast:** 0 AA failures on 3 tabs × 4 lot states × 2 themes. The hits the script flagged were all inside the closed `<details>` filter sheet. The overlay on text over photos was computed by hand:
  - Desktop hero: the proof points are at 45.9% of the width, where the overlay alpha is about 0.89, so contrast is about 10:1.
  - Phone hero: the H1 sits at alpha 0.65, about 4.6:1 over white sky (large text). The subhead is about 8.5:1.
- **Tap targets in `#app-m`:** no misses. The only elements under 44px are `.stretch` title links, which a full-card `::after` covers, and controls inside the closed sheet.
- **Overflow:** frame overflow is 0 on every tab and state, and document overflow at 390 is 0. No button, price or badge text overflows.
- **Images:** all 13 load. The lazy rail images load on scroll.
- **Console:** empty.
- **Headings:** start at h1 with no skipped levels in all 6 frame/tab combinations, and DOM order matches visual order.
- **Sticky bar:** label, price, countdown and CTA match the panel in all 4 states. It hides while the panel CTA is on screen.
- **Fee maths:**
  - Live: R 3 975 000 + R 198 750 + R 626 063 = R 4 799 813.
  - Pre-start: R 1 450 000 + R 72 500 + R 228 375 = R 1 750 875.
- **Times:**
  - Every countdown derives from Thu 20 Nov, 05:48: 42m = 06:30, 2d 4h 12/14/16m = Sat 22 Nov, 10:00/10:02/10:04, and 4d 3h 12m = Mon 24 Nov, 09:00.
  - Tue 11 Nov is the correct weekday.
- **Data across tabs:** the prices, bid counts, reserve states and make counts (5 lots) agree on Home, Event and Lot.

| #   | Item                            | Score | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visual hierarchy & scannability | 9/10  | Status, countdown, price and CTA lead on every screen and state. The bid panel reads in decision order, and the event header, terms and countdown card are in the right order.                                                                                                                                                                                                                                                                                          |
| 2   | Brand & premium feel            | 9/10  | Forest and warm tokens, Lora and Inter with tabular figures, 4–6px UI radii and 8px images. Flat sections, no card-in-card, and a dark mode that looks designed.                                                                                                                                                                                                                                                                                                        |
| 3   | Trust & transparency            | 9/10  | Premium, VAT, reserve, payment, collection, viewing, inspector and date with PDF, seller verification and bid record all sit at the decision point. The fee maths is exact, and the NH condition row no longer contradicts itself.                                                                                                                                                                                                                                      |
| 4   | Conversion clarity              | 9/10  | One state-correct CTA per lot and state, the sticky bar agrees in all 4, the pre-start hint is now truthful, and the filter sheet ends in "Show N lots" and returns to the results.                                                                                                                                                                                                                                                                                     |
| 5   | Mobile UX (375px)               | 9/10  | Correct order, every target ≥ 44px, no overflow, and filters and sort work and return to the count and chips. Nits: the "Ending this week" rail has no scroll-snap, and the hero photo shows only sky (see nits).                                                                                                                                                                                                                                                       |
| 6   | Desktop layout & space          | 9/10  | Grids align to the header edge, the 3-up Detailed grid and 3×2 terms are tidy, the sticky panel works, and Compact no longer leaves an empty cell. Compact row composition is scored under #10.                                                                                                                                                                                                                                                                         |
| 7   | Imagery                         | 9/10  | Real photos at consistent 16:9 and 4:3 crops, no cross-lot reuse, and the mosaic matches the lots. The soft 350×220 Fendt photo is now disclosed. Nit: on phone, the hero crop is clouds behind an 88% wash, so the "real John Deere 8R" is practically invisible.                                                                                                                                                                                                      |
| 8   | Copy & microcopy                | 9/10  | Labels are consistent (Opening/Current bid), amounts read "R 3 950 000", dates read "Sat 22 Nov, 10:00 SAST", and the pre-start hint is now accurate. Nit: the board note says "the only Fendt photo is a 350×220 source", but `fendt-engine.jpeg` (640×480, watermarked) exists and is still declared as `IM.fendtFront`.                                                                                                                                              |
| 9   | Accessibility & theming         | 8/10  | Contrast is AA in both themes, status always carries a word plus an icon, and the heading outline is correct. But keyboard focus is clipped on three controls. On the desktop Detailed/Compact toggle (`.view{overflow:hidden}`) the 2px ring shows only as a 2px line at the inner edge, which reads as a divider. The Home tabs (`.segctl{overflow-x:auto}`) lose the top and bottom of their ring. The phone compact-row Watch button loses its top and right edges. |
| 10  | Craft & polish                  | 8/10  | No clipping, overflow or console errors. But the new desktop Compact row looks unfinished. The reserve pill is pushed by `space-between` to the far right of the text column (about 300px from the price it qualifies). The heart floats alone in the card's top-right corner instead of sitting beside the CTA. Between price and CTA there is a gap of about 420px.                                                                                                   |

## Fixes, ordered by score impact

1. **Event + Home + Event phone · desktop + phone · light + dark · focus rings are clipped by `overflow` on the segmented controls and the compact Watch button.**
   - Draw these rings inside the element so no ancestor can clip them. Add this to the CSS after line 102 (`.app :focus-visible{…}`):
     ```css
     .app .view button:focus-visible,
     .app .segctl button:focus-visible,
     .app .lot.row > .icon-btn:focus-visible {
       outline-offset: -2px;
     }
     ```
   - On `.view button[aria-pressed="true"]:focus-visible` also add `box-shadow:inset 0 0 0 2px var(--a-primary);outline:none`, so the pressed fill and the ring don't merge.
   - Keep `.segctl{overflow-x:auto}`; it is needed for phone scrolling.
2. **Event · desktop · light + dark · Compact row: the reserve pill is detached from the price, the heart is orphaned top-right, and there is about 420px of dead space mid-row.**
   - In the `.lots.compact` rules (lines 254–257):
     - Put the pill next to the price: `.lots.compact .lot.row .price-row{justify-content:flex-start;gap:12px}`.
     - Move the heart into the CTA column: `.lots.compact .lot.row{grid-template-columns:160px 1fr auto auto;grid-template-areas:"ph b cta heart"}`.
     - Add `.lots.compact .lot.row>.icon-btn{position:static;grid-area:heart;align-self:center;margin-right:16px;border:1px solid var(--a-border);border-radius:6px}`.
     - Change `.lots.compact .lot.row .cta-row` padding to `0 8px 0 12px`.
   - Optionally, use the freed space for a fixed-width meta column (`hrs · hp`, location) so the row scans as a table, with a `minmax(0,1fr) 220px` split before the CTA.
3. **Home · phone · light + dark · nit: the hero photo is cropped to sky.** The JD 8R sits under the 0.88–0.95 part of the gradient, so the first screen reads as grey clouds, with a stray yellow wheel-hub blob behind "Sell your equipment".
   - Inside `@container (max-width:759px)`, render the photo as a 16:9 band above the copy:
     - `.hero-img{position:relative;inset:auto;aspect-ratio:16/9;height:auto;object-position:70% 70%}`
     - `.hero-ov{top:auto;height:calc(100% - 56.25cqi)}`, or simply `display:none` on phone, so the copy sits on the solid `--a-hero` background.
     - `.hero-in{padding-block:20px 24px}`
   - This also shortens the phone hero by about 100px.
4. **Board note · all · light + dark · nit: the Fendt disclosure is inaccurate.** At line 817 (the `.compare` note), change "the only Fendt photo is a 350×220 source" to: "the only clean Fendt photo is a 350×220 source (the 640×480 alternative carries a dealer watermark)".
   - Delete the unused `fendtFront` entry from `IM` (line 549), or use it as a second gallery photo with a cropped `object-position` that hides the watermark.
5. **Home · phone · light + dark · nit: the "Ending this week" rail scrolls freely and stops on half cards.**
   - Add `.rail{scroll-snap-type:x mandatory;scroll-padding-inline:16px}` and `.rail>*{scroll-snap-align:start}`.
6. **Home · desktop · light + dark · nit: reserve pills sit differently within one row.** On the 4-up rail cards, "Reserve met" fits inline beside the price, while "Reserve not met" wraps under it. The price blocks therefore differ in height and alignment.
   - Always put the pill on its own line on rail cards: `.rail .price-row{flex-direction:column;align-items:flex-start;gap:6px}`. Or shorten the pill to "Not met" / "Met", with the reserve icon carrying the meaning.
7. **Lot (registered states) · desktop + phone · light + dark · nit: the increment chips don't change the bid input or the CTA amount in the mock.** Wire `data-act="inc"` to add the step to `bid` and repaint, so a stakeholder clicking "+50 000" sees "Set max bid R 1 500 000" and the "Most you'd pay" line update.
