# Review round 4: scores

Not every item is at 9 yet. Seven items are at 9 and three are at 8.

Nearly all of the round-3 fixes landed:

- The lot DOM order now matches the visual order (h1 and bid panel come before the h2 sections).
- The phone event page has an h2 between the h1 and the h3s.
- The fee labels are honest.
- The single-photo lot has no thumb strip, and its note sits on the photo.
- The seller block is flat, and the nav baseline is fixed.
- The compact rows are 163–182px.
- The filter sheet has a scrim.
- Every tap target in `#app-m` is at least 44px, and the pre-start schedule is on one line on desktop.

What keeps the board below 9 now is mostly the photos. One lot's photos show a different model from its title, and one gallery mixes visibly different machines. There is also a board-chrome gutter bug at 390.

How I checked:

- Chrome at 1440, light and dark. I expanded both frames and screenshotted every tab.
- All 4 lot states × 2 themes. I sampled the sticky bar against the panel CTA at scrollTop 0/400/800/1400/2400 in the real 780px frame.
- The desktop sticky panel at scrollTop 0–1900.
- The phone filter sheet: opened, filtered by Case IH, then "Show 1 lot" closed it with a chip and "1 of 3 lots".
- The desktop Detailed/Compact toggle.
- The board at 390×844 with mobile and touch emulation.

Measured results:

- **Contrast:** I walked every text node in both frames, with backgrounds composited, on all 3 tabs, all 4 lot states and both themes. Nothing is below AA. The hero text over the photo is at least 4.6:1 in the worst case (phone h1 top edge, large text).
- **Tap targets in #app-m:** none below 44px. The only hit was "Clear" at 37×44, inside the closed `<details>`. Opened, it is 105×44.
- **Overflow:** none inside either frame, and none at document level at 390.
- **Images:** all load.
- **Console:** no messages.
- **Sticky bar vs panel CTA:** never both visible, and the bar text matches the CTA in all 8 combinations.
- **Desktop panel:** sticks at top 84px and releases at the end of the column.

| #   | Item                            | Score | Justification                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visual hierarchy & scannability | 9/10  | Event status and countdown, lot price and CTA lead on every screen. On the phone pre-start lot, the 3-thumb strip plus the lone Watch row push the price to y≈750 of 780. That still passes.                                                                                                                                                                           |
| 2   | Brand & premium feel            | 9/10  | Tokens, Lora/Inter, 4–6px radii, a flat seller block and a dark mode that looks designed. Remaining nits: about 300px of blank card to the right of the CTA in desktop compact cards, and the hero repeats lot 8's lead photo on the same page as lot 8's card.                                                                                                        |
| 3   | Trust & transparency            | 8/10  | The "2020 Massey Ferguson 8740 S · 400 hp" lot shows a tractor badged **8S.305** in every photo, and its own alt text says "8S". The New Holland gallery mixes a dark Blue Power T7.315 with silver rims and a light-blue T7.315 **HD** with cream rims, presented as one machine. "Photos of every angle" (How it works) contradicts "1 / 1 · More photos requested". |
| 4   | Conversion clarity              | 9/10  | One CTA per state. The CTA and sticky bar agree in all 4 states × 2 themes. The filter sheet ends in "Show N lots", and filter chips and Clear work. No dead ends.                                                                                                                                                                                                     |
| 5   | Mobile UX (375px)               | 9/10  | No overflow, every target at least 44px, a sticky Filters/Sort bar and a scrimmed sheet. Nits: the sticky-bar label wraps to 2 lines ("Closes in 2d 4h / 12m"), the pre-start note orphans "SAST", the scrim dims the open Filters control itself, and "See all lots" takes a 44px row of its own under the h2.                                                        |
| 6   | Desktop layout & space          | 9/10  | The grid aligns to the header edge, the sticky panel behaves, and the event header is now centred. About 250px of empty band remains between the header copy (ends x≈723) and the mosaic (x≈972), and compact cards have a dead zone beside the CTA.                                                                                                                   |
| 7   | Imagery                         | 8/10  | Real photos, correct 16:9 and 4:3 ratios, good `object-position`, and the gallery leads. But there is the MF model mismatch, and the NH thumbs labelled "Side view" / "Wheels and cab" are visibly different units, so the gallery fails as an inspection tool. A "1 / 1" counter on a single photo is noise.                                                          |
| 8   | Copy & microcopy                | 9/10  | The fee labels, "Any hours / Any price", one countdown format, one search placeholder, R 200 000 spacing and SAST dates are all right. Slips: "Photos of every angle". Board note 02 (pre-start) says "Three real photos … (front, side, wheels and cab)", which is four items. The Case description says "dual rear wheels included", but the photo shows singles.    |
| 9   | Accessibility & theming         | 9/10  | AA passes everywhere. DOM order now matches the visual order. The heading outline is h1 → h2 → h3 on all screens. Status always has a word, and focus rings are visible.                                                                                                                                                                                               |
| 10  | Craft & polish                  | 8/10  | At 390 the board's notes column has **0px gutter**, and the text touches both screen edges (`.lower{margin-inline:-16px}` also applies to `.notes`). Other defects: the sticky-bar label orphans "12m", the pre-start note orphans "SAST", and there is a "1 / 1" counter.                                                                                             |

## Fixes, ordered by score impact

1. **Home + Event + Lot (related) · desktop+phone · both · the MF lot is titled "2020 Massey Ferguson 8740 S · 400 hp", but `mf-cabin`/`mf-engine` both show an "8S.305" bonnet badge.** The `mfCab` alt also says "8S".
   - Retitle the lot `MF={…,title:"2021 Massey Ferguson 8S.305",hp:305,…}`.
   - Update `EVENTS[0].sum` to "One-owner Massey Ferguson 8S.305, closing this morning".
   - Change `mfFront.alt` / `mfSide.alt` to say "Massey Ferguson 8S.305".
2. **Lot (guest/reg) + Home/Event Round 2 mosaic · both · both · the NH gallery shows two different machines.**
   - `nh-cabin.jpeg` is a dark-metallic Blue Power T7.315 with silver rims. `nh-engine.jpeg` is a light-blue "T7.315 HD" with cream rims and a different cab/exhaust.
   - Keep only the photos that plausibly show one unit: `R2LOT.imgs=["nhFront","nhSide"]` (both dark blue). Drop `nhWheels` from `R2LOT` and from `EVENTS[2].imgs`.
   - For 2-image mosaics add `.mosaic.two{grid-template-columns:2fr 1fr;grid-template-rows:1fr}`, and render `class="ph mosaic${e.imgs.length===2?" two":""}"`.
   - Update note 02's pre-start text to "Two real photos exist for this lot (front, side)".
3. **Board · 390 · both · the notes column has no side gutter.** `.lower{margin-inline:-16px}` pulls `.notes` to the viewport edges: the lede, the state switcher and the list all start at x=0.
   - In the `@media (max-width:420px)` block add `.notes{padding-inline:16px}`.
4. **Home · desktop+phone · both · "Photos of every angle, a condition report, or book a viewing" overclaims** next to lots captioned "More photos requested from the seller".
   - Change it to "Photos, an AgriBid condition report, or book a viewing on the farm."
5. **Lot · phone · both · the sticky-bar label wraps to two lines** ("Current bid · Closes in 2d 4h / 12m"), so the bar is 3 text lines tall.
   - Split the label into two lines on purpose: `<span class="k">${S.bar[0]}</span><strong>…</strong><span class="k num">${S.bar[1]}</span>`.
   - Or use `dur()` without minutes when ≥1 day: `d?`${d}d ${h}h`:…` for the bar only.
   - Add `.sticky-bid>div{min-width:0}.sticky-bid .k{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`.
6. **Lot · gallery · desktop+phone · both · a "1 / 1" counter shows on a single-photo lot.**
   - Render `.gal-count` only when `l.imgs.length>1`.
   - For one photo, set the caption's `left` to `10px` (`.gal-cap.solo{left:10px}`).
7. **Lot (guest/reg) · phone · both · the pre-start note orphans "SAST"** ("…to Sat 29 Nov, 10:00 / SAST").
   - Wrap the end time: `Bidding Mon 24 Nov, 09:00 to <span class="nw">Sat 29 Nov, 10:00 SAST</span>`. The note then breaks after "to".
8. **Lot · phone · both · the lone "Watch · 23" button takes a 56px row** above the bid panel, pushing the price to y≈750 in the pre-start states.
   - In `@container (max-width:759px)`, put Watch on the meta line: `.g-title{display:grid;grid-template-columns:1fr auto;column-gap:12px}.g-title .watch{grid-column:2;grid-row:3;margin-top:0}`, with an icon-only 44×44 button (`aria-label="Watch this lot, 23 watching"`).
   - That saves about 56px and lifts the price to ≈700px.
9. **Event · phone · both · the scrim also dims the sticky Filters/Sort bar**, so the open control looks disabled.
   - Give `.m-bar` `z-index:6` (above the scrim at 4 and the panel at 5).
   - Add an open state: `.m-filter[open] summary{border-color:var(--a-primary);color:var(--a-primary)}`.
10. **Event · desktop compact · both · there is about 300px of blank card to the right of the 144px CTA.**
    - Set `.lots.compact .lot.row{grid-template-areas:"ph b" "ph b";grid-template-columns:160px 1fr}`.
    - Move the CTA into `.lot-b` under the price row (`.lots.compact .cta-row{grid-area:auto;margin-top:8px}`).
    - The card then ends at the photo's bottom edge (≈120px + padding).
11. **Event · desktop · both · an empty band of about 250px between the header copy and the mosaic.**
    - Set `.ev-head{grid-template-columns:minmax(0,1fr) 360px;column-gap:48px}`, and either let `.when` run to `max-width:none`, or move the `.terms` `<dl>` under `.facts` at ≥1100px so the left column fills its width.
12. **Home + Lot · phone · both · "See all lots" / "All live lots" take a full 44px row under the h2.**
    - Keep them inline on phone: drop `flex-basis:100%;margin-left:0` from the `@container (max-width:759px)` `.sec-head>.link` rule and keep `margin-left:auto`. The h2 is 22px, so it fits on one row at 343px.
13. **Lot (live) · desktop+phone · both · the description says "Front weights and dual rear wheels included", but the only photo shows single rear wheels.**
    - Change it to "Front weights included; dual rear wheels supplied separately (not fitted in photo)."
    - Or drop "dual rear wheels".
