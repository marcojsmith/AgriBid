# Review round 5: scores

Not every item is at 9 yet. Seven items are at 9 and three are at 8.

These round-4 fixes landed:

- The MF lot is retitled 8S.305.
- The board notes have a 16px gutter at 390.
- "Photos, an AgriBid condition report…" is fixed.
- The sticky-bar label is split onto its own line.
- There is no "1 / 1" counter on single-photo lots.
- "SAST" no longer orphans.
- Watch is icon-only on the meta row on phone.
- The m-bar is z-index 6.
- Compact CTAs sit under the body.
- "See all lots" is inline.
- The dual-wheel claim is gone.

The round-4 NH fix did not solve the problem it targeted. `nh-front.webp` and `nh-cabin.jpeg` still show two different tractors, and they are the pair the gallery now presents as one unit. A new gutter bug was also introduced on the phone thumb strip.

How I checked:

- Chrome at 1440, light and dark. I screenshotted every tab with both frames expanded, and also as unexpanded 820/780 frames scrolled through.
- All 4 lot states × 2 themes on desktop and phone.
- The phone filter sheet (opened at scrollTop 400).
- The desktop Detailed/Compact toggle.
- The board at 390×844 with mobile and touch emulation.

Measured results:

- **Contrast:** a script walked every text node in both frames, compositing backgrounds and testing text over photos against both white and black. It covered 3 tabs, 4 lot states and 2 themes. Nothing is below AA.
- **Tap targets in `#app-m`:** nothing under 44px. The only hits were `.stretch` card links, whose `::after` covers the whole card, and the search `<input>` inside a 44px `<label>`.
- **Overflow:** none in either frame, and none at document level at 390.
- **Images:** all 13 load.
- **Console:** empty.
- **Headings:** h1 → h2 → h3 on every screen.
- **Lot DOM order:** title, then bid panel, then gallery, then h2 sections.
- **Sticky bar:** it matches the panel CTA ("Set max bid R 200 000" / "Place bid R 217 500" / "Register to bid").
- **Desktop bid panel:** sticks at 84px.

| #   | Item                            | Score | Justification                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visual hierarchy & scannability | 9/10  | Status, countdown, price and CTA lead on every screen. In the phone pre-start states the price lands at y≈697 of 780, under the sticky bar, but the bar repeats it.                                                                                                                                                                                                    |
| 2   | Brand & premium feel            | 9/10  | Tokens, Lora/Inter with tabular figures and 4–6px radii are right, and the dark mode looks designed. It reads as a serious marketplace.                                                                                                                                                                                                                                |
| 3   | Trust & transparency            | 8/10  | The NH "one machine" gallery is two different tractors. Prices are not credible for the machines: a 2022 Magnum 380 with 820 hrs at R 215 000 is roughly 5% of market. To this audience that reads as a scam or test data.                                                                                                                                             |
| 4   | Conversion clarity              | 9/10  | One CTA per state. The sticky bar and panel agree in all 8 combinations. The filter sheet ends in "Show N lots". No dead ends.                                                                                                                                                                                                                                         |
| 5   | Mobile UX (375px)               | 9/10  | No overflow, every target at least 44px, a sticky Filters/Sort bar and a scrimmed sheet. Nits: the scrim still dims the open Filters control, and the panel shows a native scrollbar.                                                                                                                                                                                  |
| 6   | Desktop layout & space          | 9/10  | Grid aligned to the header, sticky panel correct, compact rows tidy. The 6-cell terms `<dl>` is squeezed into about 820px, so 3 of the 6 cells wrap to 2–3 lines.                                                                                                                                                                                                      |
| 7   | Imagery                         | 8/10  | NH front (`nh-front.webp`) is a light-blue T7 **HD** factory press shot with white rims. NH side (`nh-cabin.jpeg`) is a dark-metallic Blue Power T7.315 with silver rims. Side by side as thumbs "Front / Side view", the gallery fails as an inspection tool. The MF set is likely 3 units: three locations, and one photo has a front weight while another has none. |
| 8   | Copy & microcopy                | 9/10  | Labels, ZAR spacing, SAST dates and fee labels are consistent. Slip: lot note 02 (live) still says "with a counter", but single-photo lots no longer show one.                                                                                                                                                                                                         |
| 9   | Accessibility & theming         | 9/10  | AA everywhere, focus rings visible, status always carries a word, and the outline and DOM order are correct.                                                                                                                                                                                                                                                           |
| 10  | Craft & polish                  | 8/10  | The phone thumb strip starts at x=0 with no gutter (the h1 starts at x=16) and is capped at 299px by a stray rule. Other defects: the terms cells wrap, the footer legal links are spaced unevenly ("Terms" padded to 44px), and compact rows leave about 70px blank under the thumbnail.                                                                              |

## Fixes, ordered by score impact

1. **Lot (guest/reg) + Home/Event Round 2 card · desktop+phone · both · the NH gallery shows two different tractors.**
   - The problem: `nhFront` (light-blue T7 HD, white rims, press shot) and `nhSide` (dark Blue Power T7.315, silver rims) appear as "Front" and "Side view" of one lot.
   - Use only the photo that matches the title: `R2LOT.imgs=["nhSide"]` and `EVENTS[2].imgs=["nhSide"]`.
   - Add `.mosaic.one{grid-template-columns:1fr;grid-template-rows:1fr}`, and render `class="ph mosaic${e.imgs.length===1?" one":e.imgs.length===2?" two":""}"`.
   - The single-photo lot path (`.gal-cap.solo`, no thumbs) already handles one photo.
   - Change the `nhSide` label to "Left side", and set `nhSide.pos:"center 60%"` so the 4:3 crop keeps both wheels.
   - Update the pre-start note 02 text: "One real photo exists for this lot (left side); nh-front shows a different, newer T7 HD, so it is not used."
   - `nhFront` can stay as hero scenery only.
2. **All screens · both · both · prices are not credible for the machines** (Magnum 380 at R 215 000, 8R 410 at R 262 500, Fendt 939 at R 196 500).
   - Either use market-plausible ZAR figures (for example Case R 4 850 000, JD R 5 950 000, Fendt R 3 400 000, NH R 2 150 000, MF R 2 600 000) and rescale everything that depends on them:
     - the bid slider: `min=1500000 max=7000000 step=250000`, plus `st.maxBid` and the "Any price" check
     - the increments: `steps=[25000,50000,100000,250000]`, with next bid `+25 000`
     - the proxy hint: "R 25 000 steps"
     - the reg default max: opening + R 100 000
   - Or add a sentence to every `.compare` note: "Prices are seed values, not market estimates."
   - The first option is preferred. The board is judged as the real product, and the current figures read as fake to an R200k+ buyer.
3. **Lot (guest/reg) · phone · both · the thumb strip has no left gutter and is capped at 299px.**
   - The cause is line 375, `.m-gal .thumbs,.m-gal .gal-cap.solo{left:10px;max-width:calc(100% - 76px)}`, which applies to `.thumbs` and sits inside `.m-gal{margin-inline:-16px}`.
   - Change the selector on lines 375 and 377 to `.m-gal .gal-cap.solo` only.
   - Add `.m-gal .thumbs{padding-inline:16px;scroll-padding-inline:16px}`, and `@container (min-width:760px){.m-gal .thumbs{padding-inline:0}}`.
4. **Lichtenburg event card · desktop+phone · both · the MF mosaic mixes three settings, and `mf-front` (gravel, house, no front weight) is very likely a different unit from `mf-cabin` (brick shed, front weight).**
   - Keep the two that plausibly match. Compare `mf-engine` (wet tarmac) against `mf-cabin` and keep whichever pair matches: `MF.imgs=["mfCab","mfSide"]`, `EVENTS[0].imgs=["mfCab","mfSide"]` (the `.two` mosaic).
   - If none match, use a single photo with `.mosaic.one`.
   - Add "One photo per lot until the seller uploads a full set" to the `.compare` note.
5. **Event · desktop · both · the terms `<dl>` wraps.** At about 820px, "Buyer's / premium", "By / appointment" and "Shown on / each lot" break across 2–3 lines, so the cells have uneven heights.
   - At ≥760px use a 3×2 grid: `.terms{grid-template-columns:repeat(3,minmax(0,1fr))}`.
   - Remove `auto` from the `@container (min-width:760px)` rule.
   - Use `.terms .rules{justify-content:flex-start;padding-inline:14px}` so "Full auction rules" fills the 6th cell.
   - Add `.terms .k,.terms .v{white-space:nowrap}`.
6. **Event · phone · both · the filter-sheet scrim still dims the sticky Filters/Sort bar and its open `summary`.**
   - The cause: the scrim is `.m-panel`'s `box-shadow`, so it paints inside `.m-bar`'s own stacking context, above the bar's background.
   - Move the scrim to a sibling: `.m-filter[open]::before{content:"";position:fixed;inset:0;background:rgb(0 0 0 / .32);z-index:-1}`, and drop the `0 0 0 100vmax` shadow.
   - Or give the bar's children `position:relative;z-index:1`.
   - Also hide the panel's native scrollbar with `.m-panel{scrollbar-width:thin}`.
7. **Lot (live/glive) · board notes · both · note 02 says "with a counter"**, but a single-photo lot shows no counter.
   - Change the live text to "A 4:3 photo at top-left (full-bleed on mobile). A caption on the photo says more are requested; a counter and thumbnail strip appear once a lot has more than one photo."
8. **All screens · desktop · both · footer legal row spacing is uneven.** `.legal .flink{min-width:44px}` pads "Terms" to 44px, so the gaps run 25/18/18px.
   - At ≥760px set `.legal .flink{min-width:0}`. The 36px height already meets the desktop target.
9. **Event · desktop compact · both · rows are 192px tall, but the photo is 120px**, which leaves a blank strip of about 70px under each thumbnail.
   - Set `.lots.compact .lot.row .ph{align-self:stretch;aspect-ratio:auto;height:100%}`, keeping `object-fit:cover`. The photo then fills the row height.
10. **Event · phone · both · titles break awkwardly in compact rows** ("2021 John / Deere 8R 410") because `text-wrap:balance` acts on a 32px-padded box.
    - Set `.lot.row h3{text-wrap:pretty}`.
11. **Lot (reg) · both · both · the default maximum is R 200 000, R 20 000 above the opening bid.** That is an arbitrary preset that looks like a recommendation.
    - Default to the opening bid (`bid=l.bid` for `reg`), and leave none of the increments pressed.
