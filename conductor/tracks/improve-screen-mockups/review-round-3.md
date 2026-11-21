# Review round 3: scores

Not every item is at 9 yet. One item is at 9, seven are at 8 and two are at 7.

Most of the round-2 fixes landed. The price/pill collision is gone, the guest-live state is honest, the filter sheet has a footer, the bid field is a label, the sticky bar uses a transform and the phone frame is 375 wide. What keeps the board below 9 now is a photo/lot mismatch, a mismatch between DOM order and visual order on the lot page, and a handful of layout voids.

How I checked:

- Chrome at 1440, light and dark. I expanded both frames to their full scroll height and screenshotted every tab.
- All four lot states on desktop and phone. I tested the sticky bar at scrollTop 0/500/900/1400/2500 in the real 780px frame.
- The desktop Detailed/Compact toggle, and the phone filter sheet (filter, then "Show 1 lot", then closed).
- The board at 390×844 with mobile and touch emulation.

Measured results:

- **Contrast:** I walked every text node in both frames, in both themes and all 4 lot states, with backgrounds composited from getComputedStyle. Nothing is below 4.5:1 (or 3:1 for large text). The worst text over a photo is the phone hero h1 at its top edge: about 4.6:1 against a white-sky worst case under the 0.30→0.88 overlay. That passes as large text.
- **Overlaps:** no overlap between price and pill in any `.price-row`.
- **Overflow:** none inside either frame (`scrollWidth == clientWidth`).
- **Images:** all images load. The first pass only flagged lazy images that hadn't loaded yet.
- **Console:** no messages.
- **Tap targets in #app-m below 44px:**
  - Sort `<select>` is 42px.
  - "Full auction rules" link is 32px.
  - "See all lots" / "Read the auction rules" / "All live lots" links are 32px.
  - Footer "Terms" link is 37px wide.
  - The 20–24px `.stretch` title links are fine because their `::after` covers the whole card.

| #   | Item                            | Score | Justification                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visual hierarchy & scannability | 8/10  | Home and the live lot lead correctly. On the phone lot page, a one-item thumb strip and the gallery note push the title and price to y≈790 in a 780px frame. In the pre-start states the schedule wraps into a 3-line right-aligned block inside the countdown, and it competes with the countdown.                                                                                                     |
| 2   | Brand & premium feel            | 8/10  | Tokens, Lora/Inter, radii and dark mode are all right. But the Live and Upcoming event cards sit side by side with the same Case Magnum lead photo. The seller block is a tinted box inside a bordered card. The active nav item sits 5px above its siblings on every screen.                                                                                                                           |
| 3   | Trust & transparency            | 7/10  | The Round 2 "2020 John Deere 8R 370" (Bethal) uses the live lot 8 "8R 410" (Bethal) photos. The bonnet visibly reads "410" and the alt text says "8R 410", so it looks like a duplicate listing. The fee box says "At the current bid" to a guest who can't win at that price, and "If you win at R 240 000" for a proxy maximum.                                                                       |
| 4   | Conversion clarity              | 9/10  | Every state has one obvious CTA and the sticky bar always agrees with the panel (verified at 5 scroll positions × 4 states). The filter sheet closes with "Show N lots" and the view toggle works. One nit: "Set max bid" carries no amount, while "Place bid R 217 500" does.                                                                                                                          |
| 5   | Mobile UX (375px)               | 8/10  | No overflow, and the bid input and increment chips are at least 44px. But compact rows are still 209–235px, with about 50px of dead space under the 120×90 thumb. The filter sheet is an absolute dropdown with nested scroll and no scrim over the cards. Sort is 42px, several links are 32px, and the lot eyebrow orphans "2".                                                                       |
| 6   | Desktop layout & space          | 8/10  | The lot grid, sticky panel (checked at scrollTop 1100) and 3-column event grid all work. But the event header's left column is 157px tall beside a 287px photo+countdown column (130px void), and "2 minutes apart." orphans at 60ch inside an 828px column. Compact cards leave about 100px blank under each 90px thumb.                                                                               |
| 7   | Imagery                         | 7/10  | Real photos, correct 16:9 and 4:3 ratios, good object-position, and photos lead the lot page. But two different lots share one photo set, one of them labelled with the other's model. `caseFront` leads two event cards. The 1-photo lot still renders a thumbnail strip with a single thumb.                                                                                                          |
| 8   | Copy & microcopy                | 8/10  | Mostly plain and consistent. Slips: the search placeholder is "make or model" (desktop) vs "make, model or category" (phone). The year appears only in "Tue 11 Nov 2025". Countdown formats are mixed ("2d 4h 12m" / "4d 3h" / "2d 4h"). Province names are mixed ("KZN" / "KwaZulu-Natal"). At maximum the filters read "Up to R 300 000" next to "3 500+ hrs". The fee labels are misleading (see 3). |
| 9   | Accessibility & theming         | 8/10  | AA contrast passes everywhere, focus is visible, status always has text, and dark mode looks designed. But on the lot page the DOM order is Specifications → Condition → Description → Bid history → **h1** → bid panel. Screen-reader and Tab order hit four h2 sections before the title and the bid form (WCAG 1.3.2 / 2.4.3). The phone event page jumps from h1 to h3.                             |
| 10  | Craft & polish                  | 8/10  | Defects: the nav "Auctions" baseline is 5px off. `tabular-nums` widens the hyphen in "KwaZulu-Natal" (6.5→9.1px). Compact cards have voids. At 390 the board's phone frame clips "Sign in" and shows a horizontal scrollbar. Lot notes 02/05 still describe the Case IH while the switcher shows the John Deere.                                                                                        |

## Fixes, ordered by score impact

1. **Home + Event + Lot (pre-start) · desktop+phone · light+dark · the Round 2 "2020 John Deere 8R 370" reuses lot 8's `jdField`/`jdYard` photos.** The bonnet reads "410", the `jdYard` alt reads "John Deere 8R 410", and both lots are in Bethal. Round 2's lead photo is `caseFront`, which is also live lot 7 and the Row Crop lead.
   - `LOTS[1].imgs=["jdFront"]`.
   - `R2LOT={no:2,title:"2021 John Deere 8R 410",hrs:1210,hp:410,loc:"Ermelo, MP",…,imgs:["jdField","jdYard"]}`. Update `DET[2]` to "Engine power 410 hp" and seller `["NK","Nkosi Boerdery","Ermelo, MP"]`.
   - Round 2 event `{lots:1,region:"Mpumalanga",from:200000,imgs:["jdField","jdYard"]}`. Render its meta as "1 lot · Opening bid R 200 000", and add `.mosaic.two{grid-template-columns:2fr 1fr;grid-template-rows:1fr}` for 2-image mosaics.
   - Row Crop event and the `.ev-photo` header: `["caseFront","jdFront","nhFront"]`.
   - `MAKES`: Case IH 1, John Deere 3, "All makes 7" (update the comment to `4 + 1 + 1 + 1`).
2. **Lot · desktop+phone · both · DOM order ≠ visual order.** The h1 and bid form come after four h2 sections, so Tab reaches "Place bid" after "View all 14 bids".
   - In `lotScreen` emit `.col.right` (title + bid) **before** `.col.left`.
   - Inside `@container (min-width:760px)` add `.lot-grid .col.left{grid-column:1;grid-row:1}.lot-grid .col.right{grid-column:2;grid-row:1}`.
   - On phone, reorder the left-column markup to gallery, specs, cond, seller, hist, desc (`g-desc` currently sits before seller/hist). Then only `.g-gallery{order:-1}` differs from DOM order.
3. **Lot · glive + reg · both · the fee box overstates.** Guests can't win "at the current bid", and a proxy maximum isn't the price.
   - glive: `bid=l.bid+2500` and `feeLbl="At the next bid "+R(bid)`.
   - reg: `feeLbl="At your maximum "+R(bid)`, total label `"Most you'd pay"`, and CTA `"Set max bid "+R(bid)` (panel and sticky bar).
4. **Lot · desktop+phone · both · a 1-photo lot renders a strip with one thumbnail plus a 2-line note.** On phone this pushes the title and price to y≈790.
   - Render `.thumbs` only when `l.imgs.length>1`.
   - Move the note into the photo as a caption: `<span class="gal-cap">More photos requested from the seller</span>`, `position:absolute;left:56px;bottom:12px`, with the same chip style as `.gal-count`.
   - Target: price top ≤ 700px on phone.
5. **Event · desktop · both · 130px void under the header's left column, and the `.when` line orphans "2 minutes apart.".**
   - `.ev-head{align-items:center}`.
   - `.ev-head .when{max-width:none}`, since the column is 828px and the sentence fits on one line.
   - Or keep 60ch and move the `.terms` `<dl>` into the left column under `.facts` at ≥1100px, so both columns end together.
6. **Event · desktop compact + phone · both · rows waste space under the 120×90 thumb.** Desktop cards are 190px with a 90px photo. Phone rows are 209–235px.
   - Desktop: `.lots.compact .lot.row{grid-template-areas:"ph b" "ph cta";grid-template-columns:160px 1fr}` and `.lots.compact .lot.row .ph{aspect-ratio:4/3;align-self:start}`. The CTA then sits beside the photo, and cards are about 150px.
   - Phone: drop " · Tractor" from the eyebrow (every lot is a tractor) and put `${l.loc}` on the same `.meta` line. Target height ≤ 190px.
7. **Home + Event + Lot · desktop · both · the active nav "Auctions" is 5px above its siblings.** The `<a>` text box is at top −882 vs −877 for the buttons.
   - `.nav a{display:inline-flex;align-items:center;min-height:32px}`.
8. **Lot · pre-start · desktop · both · the schedule note wraps into a 3-line right-aligned block** ("Opens Mon 24 Nov, 09:00 / SAST · closes Sat 29 Nov / from 10:00 SAST").
   - For pre-start set `.cd{flex-wrap:wrap}.cd .note{flex-basis:100%;text-align:left;margin-top:4px}`.
   - Shorten it to "Bidding Mon 24 Nov, 09:00 to Sat 29 Nov, 10:00 SAST".
   - Use `durFull(opens)` so the countdown reads "4d 3h 12m", like the live state.
9. **Event · phone · both · the filter sheet is an absolute dropdown over the lot cards.** It has no scrim or edge and scrolls inside the scrolling frame.
   - Add `.m-panel{border:1px solid var(--a-border);box-shadow:0 16px 40px rgb(0 0 0 / .18)}`.
   - Add a scrim: `.m-filter[open]::after{content:"";position:absolute;left:-16px;right:-16px;top:100%;height:100cqh;background:rgb(0 0 0 / .32);z-index:4}`. The panel is `z-index:5`.
   - Clicking the scrim does `act({dataset:{act:"close"}})`.
10. **Lot · desktop+phone · both · the seller block (and its trust strip) is a card-in-card.**
    - Flatten it: `.g-seller{border:0;background:none;padding:20px 0 0;border-top:1px solid var(--a-border)}`.
    - `.verified-note{background:none;padding:0;color:var(--a-ok-fg)}`.
11. **Event · phone · both · the heading jumps from h1 to h3** (the "Filter lots" h2 is hidden on phone).
    - Change `<span class="cnt num">` into `<h2 class="cnt num">`, styled at the same 14px/600, so the cards' h3s sit under it.
12. **Lot · phone · both · the eyebrow "LOT 2 · TRACTOR · ROW CROP TRACTOR SALE: ROUND 2" orphans "2".**
    - Wrap the sale in `<span class="sale"> · ${sale}</span>` and add `@container (max-width:759px){.g-title .sale{display:none}}`. The breadcrumb already names the sale.
13. **Event · desktop+phone · both · `.facts.num` widens the hyphen in "KwaZulu-Natal" (6.5→9.1px).**
    - Remove `num` from `.facts` and put it only on the three numeric spans.
    - Use one province style: "KwaZulu-Natal" in full on event cards too (`region:"Free State, Mpumalanga, KwaZulu-Natal"`), or "KZN" everywhere.
14. **Copy · all · inconsistencies.**
    - Phone search placeholder → "Search make or model" (there are no categories).
    - "Inspected by AgriBid on Tue 11 Nov 2025" → "Tue 11 Nov".
    - At the slider maxima show "Any hours" / "Any price" instead of "3 500+ hrs" / "Up to R 300 000".
    - Use `durFull` for the event-card chips too, or `dur` everywhere, but one format.
15. **Event + Home · phone · both · targets under 44px.**
    - `.selbox select{height:100%;min-height:44px}`.
    - `.link.rules-m,.sec-head>.link,.related .link{min-height:44px;display:inline-flex;align-items:center}`.
    - Footer `.legal .flink{min-width:44px}`.
16. **Board · 390 · both · the phone frame is wider than the 358px column.** "Sign in" and the "Results" pill are clipped, and a horizontal scrollbar shows under the frame.
    - `@media (max-width:420px){.lower{margin-inline:-16px}.phone{padding:0;border:0;border-radius:0;background:none;display:flex;justify-content:center}}`. That gives 390 − 375 = 7.5px gutters and no sideways scroll.
17. **Board notes · lot tab · both · notes 02 ("Only one real photo exists for this lot") and 05 ("2022 Case IH Magnum 380…") stay unchanged in the pre-start states, which show the John Deere.**
    - Make `NOTES.lot` a function of `lotState`. For guest/reg, swap the note 02 text to "Two photos exist for this lot" and the note 05 title to the R2LOT title.
