# Review round 10: scores

Not every item is at 9 yet. Nine items are at 9 and one is at 8. The 8 is new and takes a one-line fix: in the desktop Compact list, the thumbnails stop short of the row height and leave an empty strip of card under the photo.

All round-9 fixes landed:

- The focus rings on `.view`, `.segctl` and the compact Watch button now draw inside the control. Forcing `focus({focusVisible:true})` on every focusable control on all 3 tabs found 0 controls clipped by an `overflow` ancestor and 0 without a ring. The pressed Compact button shows an inset ring.
- The Compact row is now photo, title and meta, price + reserve pill, Bid, then Watch. The heart sits beside the CTA and the pill sits next to the price.
- The phone hero is a 16:9 photo band above the copy on a solid `--a-hero` background, and the JD 8R reads clearly.
- The Fendt note is accurate ("the 640×480 alternative carries a dealer watermark"), and `fendtFront` is gone from `IM`.
- The rail has `scroll-snap`, and rail pills sit on their own line.
- The increment chips repaint the input, CTA, fee rows and sticky bar. For example, +100 000 gives R 4 050 000 + R 202 500 + R 637 875 = R 4 890 375.

How I checked:

- Chrome at 1440, light and dark.
- Expanded `#app-d` and `#app-m` to their full scroll height and stepped through them, then scrolled the real frames, including the sticky panel.
- All 4 lot states, with the chips, on both frames and in both themes.
- Desktop Detailed and Compact.
- The phone filter sheet: Fendt toggled, then "Show 1 lot" (returns "1 of 3 lots" with a Fendt chip), then Clear filters.
- The board under emulation at 390×844×3, mobile and touch.

Measured results:

- **Contrast:** 0 AA failures on 3 tabs × 4 lot states × 2 themes. The phone hero copy now sits on solid `--a-hero`. On the desktop hero, the proof points end at about 50% of the width, where the overlay alpha is about 0.83 over the dark tractor body.
- **Tap targets in `#app-m`:** no misses. The only element under 44px is the search `<input>`, inside its 44px label.
- **Filter sheet:** rows, ranges and footer buttons are all 44px.
- **Overflow:** frame and document overflow is 0 everywhere, including at 390. No text overflows its button, pill or badge. One desktop element is wider than its box (`.trust` 457 > 435, see the nits).
- **Images:** all load.
- **Console:** empty.
- **Headings:** start at h1 with no skipped levels in every frame, tab and state.
- **Sticky panel:** the desktop panel is 571, 732, 677 and 560px tall in the 4 states. With `top:84px` it fits the 820px frame in every state; the registered pre-start state leaves 4px.
- **Fee maths:**
  - Live: R 3 975 000 + R 198 750 + R 626 063 = R 4 799 813.
  - Pre-start: R 1 450 000 + R 72 500 + R 228 375 = R 1 750 875.
- **Times:** all derive from Thu 20 Nov, 05:48 (42m, 2d 4h 12/14/16m, 4d 3h 12m). The weekdays are right: Mon 17, Tue 11, Sat 22, Mon 24 and Sat 29 Nov.
- **Data across tabs:** prices, bid counts, reserve states and the 5-lot make counts agree on Home, Event and Lot.

| #   | Item                            | Score | Justification                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Visual hierarchy & scannability | 9/10  | Status, countdown, price and CTA lead on every screen and state. The bid panel reads in decision order, and the Compact row now scans left to right as a table.                                                                                                                                                                                                          |
| 2   | Brand & premium feel            | 9/10  | Forest and warm tokens, Lora and Inter with tabular figures, 4–6px UI radii and 8px images. Flat sections, no card-in-card, and a dark mode that looks designed.                                                                                                                                                                                                         |
| 3   | Trust & transparency            | 9/10  | Premium, VAT, reserve, payment, collection, viewing, inspector and date with PDF, seller verification and bid record all sit at the decision point. The fee maths is exact in every state and chip choice, and the photo disclosure is now accurate.                                                                                                                     |
| 4   | Conversion clarity              | 9/10  | One state-correct CTA per lot and state. The chips update the CTA and the sticky bar together, the sticky bar agrees in all 4 states and hides while the panel CTA is visible, and the filter sheet ends in "Show N lots".                                                                                                                                               |
| 5   | Mobile UX (375px)               | 9/10  | Correct order, every target ≥ 44px, no overflow at 375 or 390, filters and sort work, and the rail snaps. Nits: the rail is clipped at the 16px gutter rather than bleeding to the frame edge, and there is a 40px gap above the Filters bar.                                                                                                                            |
| 6   | Desktop layout & space          | 9/10  | Grids align to the header edge, the 3-up Detailed grid and 3×2 terms are tidy, the sticky panel fits every state, and the Compact row has no dead middle. Nit: the Compact title column is only 188px, so "2022 Case IH / Magnum 380" wraps.                                                                                                                             |
| 7   | Imagery                         | 9/10  | Real photos at consistent 16:9 and 4:3 crops, no cross-lot reuse, a phone hero that finally shows the machine, and an honest single-photo caption. The Compact thumbnail bug is scored under #10.                                                                                                                                                                        |
| 8   | Copy & microcopy                | 9/10  | Labels are consistent (Opening/Current bid, "At your maximum", "Most you'd pay"), amounts read "R 3 950 000", dates read "Sat 22 Nov, 10:00 SAST", and the board note is now true.                                                                                                                                                                                       |
| 9   | Accessibility & theming         | 9/10  | AA in both themes, status always carries a word plus an icon, the heading outline is correct, and every focus ring is visible and unclipped. The pressed segmented button uses a contrasting ring colour.                                                                                                                                                                |
| 10  | Craft & polish                  | 8/10  | Desktop Compact thumbnails don't fill their row. The row's inner height is 110px, but the photos measure 107, 90 and 101px (Case, JD, Fendt), leaving a strip of card colour under each photo. It is 20px on the JD row, and it is obvious in dark mode. Because the countdown chip is pinned to the photo's bottom, the chips sit at 3 different heights down the list. |

## Fixes, ordered by score impact

1. **Event · desktop · light + dark · Compact thumbnails are shorter than the row, leaving a 3–20px empty strip under each photo, and the countdown chips float at uneven heights.** `height:100%` doesn't resolve against the auto-height grid row, so each photo keeps its intrinsic height.
   - Change line 267 to `.lots.compact .lot.row .ph{width:160px;align-self:stretch;aspect-ratio:auto;height:auto;min-height:100%}`.
   - Add `.lots.compact .lot.row .ph img{position:absolute;inset:0;width:100%;height:100%}`.
   - Re-measure: every `.ph` and its `img` should be 110px tall, and the `.chip-time` bottoms should all sit 6px above the row bottom.
2. **Event · desktop · light + dark · nit: the Compact title column is only 188px, so "2022 Case IH Magnum 380" wraps to 2 lines while the other rows use 1.** In `.lots.compact .lot.row .lot-b` (line 261), change `grid-template-columns:minmax(0,1fr) 270px;column-gap:32px` to `minmax(0,1fr) 230px;column-gap:24px`. The widest price + pill is about 240px, so check that the "Reserve not met" rows still fit on one line. If not, keep 270px and reduce `.lots.compact .lot.row .cta-row .btn{min-width}` from 200px to 176px.
3. **Event · phone · light + dark · nit: the gap between the "First lot closes in" card and the Filters/Sort bar is 40px, against 16px everywhere else in the header.** Remove the inline `style="margin-top:14px"` on `.m-bar` (line 710). Or, inside `@container (max-width:759px)`, set `.ev-head{padding-bottom:8px}`.
4. **Home · phone · light + dark · nit: the "Ending this week" rail is clipped at the 16px content gutter, so the peeking card is cut off mid-air instead of running off the screen edge.** Inside `@container (max-width:759px)`, add `.rail{margin-inline:-16px;padding-inline:16px}`. `scroll-padding-inline:16px` already keeps the snap aligned to the gutter.
5. **Lot · desktop · light + dark · nit: the "How bidding works" link box is 22px wider than `.trust`, measured 457 > 435.** The cause is `flex-basis:100%` plus `margin-left:22px`. Change `.trust .link` (line 439) to `flex-basis:calc(100% - 22px)`.
6. **Lot · desktop + phone · light + dark · nit: inline link sizes differ.** "How bidding works" is 12.5px, while "View profile" and "All live lots" are 14px. Give the in-panel link `font-size:13px`, and set `.seller-act .link{font-size:13.5px}` to match the seller meta, so links within a section match their surrounding text.
7. **Lot (registered states) · desktop + phone · light + dark · nit: typing in the bid input doesn't update the CTA or the fee rows.** Only the chips do. Add an `input` listener on `.bid-input input` that parses the digits into `st.add = value - l.bid` (clamped to ≥ 25 000 when live and ≥ 0 before the start). Repaint on `change`, or keep the caret by updating only the CTA and fee text nodes.
