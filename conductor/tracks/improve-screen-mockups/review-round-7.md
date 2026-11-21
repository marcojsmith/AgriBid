# Review round 7: scores

Not every item is at 9 yet. Eight items are at 9 and two are at 8. Both 8s come from one regression: the round-6 "show Reserve on phone" fix broke the desktop terms grid.

These round-6 fixes landed:

- Phone compact rows now put a full-width 44px CTA under the photo and body, and the label fits.
- `R()` and `nbR` use non-breaking spaces, so no price splits anywhere.
- Compact titles keep the model number together ("2022 Case IH / Magnum 380").
- The event lede now says "R1m–R5m buyer".
- Lot 8 uses only `jdFront`. The Row Crop mosaic is `caseFront`, `jdFront`, `fendtFront`, and the hero uses `jd-cabin` as scenery.
- Phone terms show "Reserve: Shown on each lot" full-width.
- The condition hint reads "Inspected by AgriBid on Tue 11 Nov · Full report below as PDF".
- The registered proxy hint changes when the max equals the opening bid.
- The Fendt is retitled 2022 to match the Gen6 styling in the photo.
- The filter sheet has `scrollbar-width:none`, and the increment chips are 12.5px on phone.

How I checked:

- Chrome at 1440, light and dark, with `#app-d` and `#app-m` scrolled through on every tab.
- All 4 lot states on both frames and in both themes.
- Desktop Detailed/Compact.
- The phone filter sheet, opened mid-scroll: toggled a make, scrolled the sheet, "Show 1 lot" closed it, then I checked the chips and Clear.
- The board at 390×844 with mobile and touch emulation.

Measured results:

- **Contrast:** a script composited every text node over its painted backgrounds, and over both white and black under photos. It covered 3 tabs, 4 lot states and 2 themes. Nothing is below AA. Hero text was checked by hand against the overlay: the phone H1 top is about 4.5:1 over white sky, and it's large text.
- **Tap targets in `#app-m`:** the only items under 44px are `.stretch` title links, whose `::after` covers the whole card. No real misses.
- **Overflow:** no frame overflow. No `scrollWidth > clientWidth` on any button, badge, pill or price (only `.sr` hits). No document overflow at 390.
- **Images:** all load.
- **Console:** empty.
- **Headings:** start at h1 with no skipped levels, in all 6 frame/tab combinations.
- **Sticky bar:** the label, price and CTA match the panel in all 4 states, and the bar hides while the panel CTA is visible.
- **Fee maths:**
  - Live and guest-live: R 3 975 000 + R 198 750 + R 626 063 = R 4 799 813.
  - Guest and registered pre-start: R 1 450 000 + R 72 500 + R 228 375 = R 1 750 875.
- **Prices and times agree across tabs:**
  - Card "Bid R 3 975 000" = lot CTA.
  - "From R 2 650 000" = Fendt.
  - MF R 2 150 000 closes in 42m = 06:30.
  - NH opens in 4d 3h 12m = Mon 24 Nov, 09:00.
  - First lot closes in 2d 4h 12m = Sat 22 Nov, 10:00.
  - Every weekday is correct for Nov 2025.

| #   | Item                            | Score | Justification                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visual hierarchy & scannability | 9/10  | Status, countdown, price and CTA lead on every screen and state. The bid panel reads in decision order, and the phone compact rows now give price then a clear full-width action.                                                                                                                                                                       |
| 2   | Brand & premium feel            | 9/10  | Forest/warm tokens, Lora/Inter with tabular figures, and 4–6px UI radii (8px images). Flat sections, no card-in-card, and a dark mode that looks designed. The desktop terms block now has grey holes (see #6), which cheapens the event header.                                                                                                        |
| 3   | Trust & transparency            | 9/10  | Premium, VAT, reserve, payment, collection, viewing, inspection date plus PDF, seller verification and bid record all sit at the decision point. The fee maths is exact, and the photo limits are disclosed. Nit: "2022 Fendt 939 Vario, Reserve met at R 2 650 000" is about half its market value, so the reserve looks implausible.                  |
| 4   | Conversion clarity              | 9/10  | One state-correct CTA per lot and state, and the sticky bar agrees in all 4. The filter sheet ends in "Show N lots" and returns to the list with removable chips. Nit: in the registered pre-start state the hint says "Set a maximum above the opening bid" while the CTA offers "Set max bid R 1 450 000".                                            |
| 5   | Mobile UX (375px)               | 9/10  | Compact rows are fixed (full-width 44px CTA), no overflow, all targets ≥ 44px, sticky Filters/Sort with a working sheet, and the thumb-reach sticky bid bar is right. Nit: on the lot page, "Download inspection PDF" and "Book a viewing" wrap into two ragged, left-aligned buttons.                                                                  |
| 6   | Desktop layout & space          | 8/10  | Regression: `.terms .wide{grid-column:1/-1}` now applies at desktop. The 3-column terms `<dl>` becomes 4 rows, with two empty grey cells (cols 2–3 beside "Collection" and beside "Full auction rules"). The block grows to 249px tall instead of about 130px. Everything else is aligned: 3-up cards, filled compact rows, and a sticky panel at 84px. |
| 7   | Imagery                         | 9/10  | Real photos at consistent 16:9/4:3. Every lot has its own photo with no cross-lot reuse, the Row Crop mosaic matches lots 7/8/11, and single-photo lots are handled honestly. Remaining (acknowledged): the Fendt lead `fendt-engine.jpeg` still shows a faint third-party watermark on the front wheel.                                                |
| 8   | Copy & microcopy                | 9/10  | Labels (Opening bid, Current bid), "R 3 950 000", "Sat 22 Nov, 10:00 SAST" and the lede are all correct. Nits: the proxy hint vs the CTA (see #4), and "…Full report below as / PDF" orphans "PDF" on phone.                                                                                                                                            |
| 9   | Accessibility & theming         | 9/10  | AA in both themes, including text over photos. Visible focus ring, status always carries a word plus an icon, the heading outline and DOM order are correct, and the sheet keeps focus on the toggled checkbox.                                                                                                                                         |
| 10  | Craft & polish                  | 8/10  | The desktop terms-grid holes are a visible layout bug in both themes, right under the event H1. The phone condition-action buttons are ragged. No console errors and no clipping.                                                                                                                                                                       |

## Fixes, ordered by score impact

1. **Event · desktop · light + dark · the terms grid has two empty grey cells and four rows.** The base rule `.terms .wide{grid-column:1/-1}` (line 309, added so Reserve spans on phone) is never reset in the `@container (min-width:760px)` block, so Reserve spans all 3 columns and pushes Collection and Rules into rows of their own.
   - Inside the existing `@container (min-width:760px){…}` terms block, change `.terms .wide{display:flex}` to `.terms .wide{display:flex;grid-column:auto}`.
   - Result: a 3×2 grid of Premium / Payment / Viewing, then Collection / Reserve / Full auction rules. That restores round-6 behaviour, and phone keeps the full-width Reserve.
2. **Lot · phone · both · "Download inspection PDF" and "Book a viewing" wrap into two left-aligned buttons of different widths** (209px + 142px don't fit in 343px).
   - Add `@container (max-width:759px){.cond-act{display:grid;grid-template-columns:1fr}.cond-act .btn{width:100%}}`. That gives two equal full-width 44px buttons.
   - Alternatively, shorten the label to "Inspection PDF" and use `grid-template-columns:1fr 1fr`.
3. **Event + Home + Lot rail · all · both · the Fendt price is implausible.** A 2022 Fendt 939 Vario with 3 050 hrs shows "Reserve met" at R 2 650 000, which is about half of market (R 5m+).
   - Minimal fix that keeps every cross-tab price: set `LOTS[2].res="not"` so it reads "Reserve not met".
   - Alternative: raise `LOTS[2].bid` to 4 650 000. That changes "From R 2 650 000" to "From R 3 950 000" in `EVENTS[1].from` and in the event facts `R(2650000)`, and the bid filter still works under R 5m.
4. **Lot (registered, before start) · both · both · the hint contradicts the CTA.** The hint says "Set a maximum above the opening bid…" while the button says "Set max bid R 1 450 000".
   - When `bid===l.bid`, render "Bid the opening R 1 450 000 now, or raise your maximum and we bid for you in R 25 000 steps, only as far as needed."
   - Alternatively, keep the hint and change the CTA in that case to "Bid the opening R 1 450 000".
5. **Lot · phone · both · the condition hint orphans "PDF"** ("…Full report below as / PDF").
   - Wrap the tail in `<span class="nw">below as PDF</span>`, or add `text-wrap:pretty` to `.g-cond .hint`.
6. **Event · desktop + phone · both · nit: the Fendt lead `fendt-engine.jpeg` still carries a faint third-party watermark on the front wheel.** It is disclosed in the board note.
   - Optionally lead with `fendtGrass` (`fendt-cabin.jpeg`, no watermark): `LOTS[2].imgs=["fendtGrass","fendtFront"]`.
   - Use `fendtGrass` in the Row Crop mosaic and the `.ev-photo` array too, so the card photo and the gallery's first photo stay the same.
