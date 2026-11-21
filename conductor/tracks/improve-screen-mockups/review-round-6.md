# Review round 6: scores

Not every item is at 9 yet. Eight items are at 9 and two are at 8.

These round-5 fixes landed:

- Prices are now market-plausible: R 1 450 000 to R 4 250 000, with +R 25 000 steps and a R 1m–R 5m bid filter.
- The NH lot and its Round 2 card use the single `nhSide` photo, with `.mosaic.one`.
- MF uses the single `mfCab` photo.
- The phone thumb gutter is fixed.
- The terms `<dl>` is a 3×2 grid with no wrapping.
- The filter scrim no longer dims the Filters/Sort bar.
- Note 02 copy is fixed.
- The footer legal row is evenly spaced.
- The compact desktop photo fills the row.
- The registered default max is the opening bid, with no chip pressed.

Two new defects came in with the price rescale:

- Seven-digit CTAs no longer fit the phone compact rows.
- `R()` lets a price break across lines.

How I checked:

- Chrome at 1440, light and dark, with both frames scrolled through on every tab.
- All 4 lot states on desktop and phone, in both themes.
- Desktop Detailed/Compact.
- The phone filter sheet, opened mid-scroll.
- The board at 390×844 with mobile and touch emulation.

Measured results:

- **Contrast:** a script composited every text node's background, testing text over photos against both white and black. It covered 3 tabs, 4 lot states and 2 themes. Nothing is below AA.
- **Tap targets in `#app-m`:** nothing under 44px. The only hit was "Clear" inside the closed `<details>`, which has 0 render. With the sheet open there were no hits.
- **Overflow:** none in either frame, and none at document level at 390.
- **Images:** all load.
- **Console:** empty.
- **Headings:** h1 → h2 → h3 everywhere.
- **Sticky bar:** it matches the panel CTA in all 4 states.
- **Fee maths:** consistent on every tab and state. For example, live: R 3 975 000 + R 198 750 premium + R 626 063 VAT (15% of bid + premium) = R 4 799 813. Opening: R 1 450 000 + R 72 500 + R 228 375 = R 1 750 875.
- **Prices agree across tabs:**
  - card "Bid R 3 975 000" = event note = lot CTA
  - "From R 2 650 000" = the Fendt lot
  - "Current bid R 2 150 000" = MF
  - "Opening bid R 1 450 000" = NH
  - "First lot closes in 2d 4h 12m" = Case close

| #   | Item                            | Score | Justification                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visual hierarchy & scannability | 9/10  | Status, countdown, price and CTA lead on every screen and state. The bid panel reads in decision order, and the sticky bar repeats the price when the panel is below the fold.                                                                                                                                                                        |
| 2   | Brand & premium feel            | 9/10  | Forest/warm tokens, Lora/Inter with tabular figures, and 4–6px UI radii (8px images). Flat sections, no card-in-card, and a designed dark mode. With credible R-millions pricing it now reads as a serious marketplace.                                                                                                                               |
| 3   | Trust & transparency            | 9/10  | Premium, VAT, reserve, payment, collection, viewing, inspection, seller verification and bid record all sit at the decision point. The fee maths is exact, and the photo limits are disclosed. Nits: "Report reference on request" sits beside a "Download inspection PDF" button, and the phone terms grid drops the Reserve row.                    |
| 4   | Conversion clarity              | 9/10  | One state-correct CTA per lot and state. The sticky bar agrees in all 4 states, the filter sheet ends in "Show N lots", and there are no dead ends.                                                                                                                                                                                                   |
| 5   | Mobile UX (375px)               | 8/10  | In the event compact rows, "Bid R 3 975 000" is forced into a 104px button under the thumbnail. The 99px label overruns the 6px padding, leaving about 2.5px each side, so the text touches the edges on all 3 rows. Everything else is solid: 44px targets, no overflow, a sticky Filters/Sort bar.                                                  |
| 6   | Desktop layout & space          | 9/10  | Grid aligned to the header, 3-up cards, a 3×2 terms grid without wrapping, the bid panel sticks at 84px, and compact rows are filled.                                                                                                                                                                                                                 |
| 7   | Imagery                         | 9/10  | Real photos at consistent 16:9/4:3, single-photo lots handled honestly with a caption, no 1/1 counter. Nits: the Row Crop mosaic's JD tile (`jd-cabin`: single wheels, front linkage, slurry tanker) is a different unit from lot 8's card photo (`jd-front`: duals). The "2018 Fendt 939" photo shows current-generation Fendt styling.              |
| 8   | Copy & microcopy                | 9/10  | Labels (Opening bid, Current bid), "R 3 950 000" and "Sat 22 Nov, 10:00 SAST" are consistent. The event lede still says "an R200k buyer" although lots are now R1.45m–R4.25m.                                                                                                                                                                         |
| 9   | Accessibility & theming         | 9/10  | AA in both themes including text over photos, a visible focus ring, status always carries a word plus an icon, and a correct outline and DOM order.                                                                                                                                                                                                   |
| 10  | Craft & polish                  | 8/10  | Two wrapping bugs. On the registered pre-start hint, `R()` uses plain spaces, so the figure breaks as "…up to R / 1 450 000." On the desktop panel the "R" is orphaned at the line end. In phone compact rows, the titles orphan their model number ("2022 Case IH Magnum / 380", "2021 John Deere 8R / 410"); `text-wrap:pretty` did not prevent it. |

## Fixes, ordered by score impact

1. **Event · phone · both · compact-row CTA "Bid R 3 975 000" is crammed into the 120px photo column** (the label is 99px in a 104px button, overrunning its padding).
   - Move the CTA to a full-width row under the photo and body: `.lot.row{grid-template-areas:"ph b" "cta cta"}`.
   - Set `.lot.row .cta-row{padding:0 12px 12px}` and `.lot.row .cta-row .btn{padding:0 16px;font-size:14px}`.
   - Leave `.lots.compact .lot.row` (desktop) as it is, since it already overrides the areas.
   - Update note 06 on the event tab: "…and a full-width 44px green button under the row."
2. **All screens · desktop + phone · both · prices can break between "R" and the digits** (registered pre-start hint: "up to R / 1 450 000.").
   - Make the formatter non-breaking: `const R=n=>"R "+String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g," ");`.
   - This matches `nbn`. No CSS change is needed.
3. **Event · phone · both · compact titles orphan the model number** ("Magnum / 380", "8R / 410").
   - In `lotCard`, glue the last two words: `const t=l.title.replace(/ (\S+)$/," $1");` and render `${t}` in the `<h3>`.
   - Set `.lot.row h3{text-wrap:balance}`. The result is "2022 Case IH / Magnum 380" and "2021 John Deere / 8R 410".
4. **Event · board notes · both · the lede says "an R200k buyer"**, but lots are now R1.45m–R4.25m.
   - Change NOTES.event.lede to "Puts the terms a R1m–R5m buyer needs on the page, and swaps the disabled \"Not Started\" button for an action."
5. **Home + Event · desktop + phone · both · the Row Crop mosaic's JD tile is a different tractor from lot 8.** `jd-cabin` has single wheels, front linkage and a tanker; `jd-front` on the lot card has duals. Lot 8's data also still groups 3 different units (`jdFront`, `jdField`, `jdYard`), which contradicts the `.compare` note.
   - Set `LOTS[1].imgs=["jdFront"]`.
   - Use `["caseFront","jdFront","fendtFront"]` for both `EVENTS[1].imgs` and the `.ev-photo` mosaic in `eventScreen`.
   - Swap the home hero to `assets/jd-cabin.jpeg` (pure scenery, tied to no lot), with `object-position:60% 45%`. The "(the hero reuses lot 8's lead as scenery)" clause can then go from the `.compare` note.
6. **Event · phone · both · the terms grid hides "Reserve: Shown on each lot"** (`.terms .wide{display:none}` below 760px), so phone buyers lose the reserve policy.
   - Show it full-width on phone: `.terms .wide{display:flex;grid-column:1/-1}`.
   - Keep `.terms .rules` hidden there, because `.rules-m` covers it.
7. **Lot · both · both · the condition hint "Report reference on request" contradicts the "Download inspection PDF" button below it.**
   - Change it to "Inspected by AgriBid on Tue 11 Nov · Full report below as PDF".
8. **Lot (reg) · both · both · the proxy hint is meaningless when the max equals the opening bid** ("only as far as needed, up to R 1 450 000").
   - When `bid===l.bid`, render "Set a maximum above the opening bid and we bid for you in R 25 000 steps, only as far as needed."
   - Otherwise keep the current sentence.
9. **Event · desktop + phone · both · the "2018 Fendt 939 Vario" photo (`fendt-engine.jpeg`) shows current-generation Fendt styling** (narrow LED headlight band, new bonnet), not a 2018 S4 939. It also carries a watermark.
   - Either retitle to match the photo (for example "2023 Fendt 942 Vario", 1 450 hrs, and raise the bid accordingly), or use `fendt-cabin.jpeg` as the lead with `pos:"center 55%"` and give it the alt "Green Fendt Vario tractor with red rims on grass".
   - The second option also removes the only visible watermark.
10. **Event · phone · both · nit: the filter sheet still shows a native scrollbar track.**
    - Set `.m-panel{scrollbar-width:none}`. The sticky `.m-foot` already signals more content.
11. **Lot (reg/live) · phone · both · nit: increment chips "+100 000" and "+250 000" have 5px side padding in 73px chips.**
    - Set `.inc button{font-size:12.5px;letter-spacing:-.01em}` below 760px. Alternatively, use `grid-template-columns:repeat(2,1fr)` on phone so the chips are 2×2 at 44px.
