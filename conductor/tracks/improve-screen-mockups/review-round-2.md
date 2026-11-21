# Review round 2: scores

Not all items are at 9 or above. Six items are at 8 and three are at 7.

I checked the board in Chrome at 1440 wide, in light and dark, scrolling both frames through their full height on every tab. On the lot tab I checked all three bidding states. I also checked the board at 390×844 with mobile and touch emulation.

Measured results:

- **Contrast:** I computed it from getComputedStyle for every text node in both frames, in both themes and all lot states. Nothing fails. The lowest values are the Upcoming badge at 5.13:1, the neutral pill and countdown label at 5.67:1 (light), and the dark primary button at 5.72:1.
- **Overflow:** none. scrollWidth equals clientWidth in both frames on every tab.
- **Images:** all 13 assets load.
- **Console:** no errors. There is one DevTools issue, "form field should have an id or name" (×80).

| #   | Item                            | Score | Justification                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Visual hierarchy & scannability | 8/10  | Lot page and home lead correctly. On the event page (desktop) the reserve pill covers the lot price, and the header floats in about 110px of empty space above the title. On the phone pre-start lot page, the status line wraps to two rows.                                                             |
| 2   | Brand & premium feel            | 8/10  | Tokens, Lora/Inter, 4–6px radii and flat sections are all right, and dark mode looks designed. But the same John Deere photo appears three times (hero, Row Crop mosaic lead, event header), and the phone hero photo is invisible under a 90% overlay.                                                   |
| 3   | Trust & transparency            | 7/10  | Fees, VAT, payment and verification are all present. Contradictions remain: the Round 2 card leads with a tracked Magnum and includes a New Holland that isn't in that sale; lot 7 is both live at R 215 000 and "opening R 200 000" in Round 2; the condition report has no inspector or date.           |
| 4   | Conversion clarity              | 8/10  | CTAs fit each state and the sticky bar agrees with the panel. But the Live state shows a guest header (Sign in / Register) next to "Place bid". The phone filter panel has no "Show N lots" or close action. The desktop Detailed/Compact toggle does nothing.                                            |
| 5   | Mobile UX (375px)               | 8/10  | No overflow and almost every target is at least 44px. But the bid `<input>` is only 27px tall inside a 48px box that isn't a label. Compact rows waste about 130px under each thumbnail. The terms grid pushes the first lot to y≈720. "Read the auction rules" wraps onto its own line.                  |
| 6   | Desktop layout & space          | 7/10  | The 4-column lot grid next to the 240px sidebar gives cards about 226px wide, and price and pill collide (measured overlap of 9–40px). The event header has dead space on the left. "Browse by make" leaves an orphan 5th row.                                                                            |
| 7   | Imagery                         | 8/10  | Real photos throughout, correct 16:9 and 4:3 ratios, good object-position, and photos lead the lot page. But the board admits the tracked-Magnum photo is wrong, and it is still the Round 2 lead image and lot photo 2. The John Deere photo is reused three times.                                      |
| 8   | Copy & microcopy                | 8/10  | Mostly plain, SAST-dated and consistent. Slips: the filter chip reads "Up to 2000 hrs" (no thin space), bid history mixes "1 h ago" with "2 min ago", step 3's title doesn't match its body, "From R 238 000" is shown on a 1-lot sale that already has bids, and there is a shouty uppercase date badge. |
| 9   | Accessibility & theming         | 8/10  | Contrast passes in both themes, focus is visible, and status always has text. But the bid field's hit area is 27px, 80 inputs have no `name`, the view toggle has a static `aria-pressed`, the nav marks "Auctions" as current on Home, and the filter results count isn't announced to the open panel.   |
| 10  | Craft & polish                  | 7/10  | The price/pill collision is a visible bug. The sticky bar toggles `display:none` (scrollHeight jumps by 65px while scrolling). At 390 the board's URL pill is crushed to "ag" and the viewport label is clipped. The phone frame renders at 368px (336px on a 390 device), not 375.                       |

## Fixes, ordered by score impact

1. **Event · desktop · light+dark · the reserve pill overlaps the price on 226px cards (R 215 0⟨pill⟩, R 262 5⟨pill⟩), and "Current bid · 9 bids" wraps to 3 lines.**
   - In `.lots` change to `grid-template-columns:repeat(auto-fill,minmax(260px,1fr))` inside `@container (min-width:760px)`. That gives 3 columns at 1440.
   - Also make `.price-row{flex-wrap:wrap;row-gap:6px}` and `.price-row strong{min-width:max-content}`, so the pill drops below the price instead of covering it on any width.
2. **Lot · desktop+phone · both · the Live state shows a guest header (Sign in / Register to bid) beside "Place bid R 217 500".**
   - In `lotScreen`, call `header(lotState!=="guest")` so the Live and Registered states both show avatar + My bids.
   - Add a 4th switcher state, "Guest, live", whose CTA is "Register to bid" and which has no input. That covers the guest-during-live case honestly.
3. **Home + Event · all · the tracked-Magnum photo (`caseField`) is the Round 2 lead image, and the mosaic includes `nhSide` although New Holland isn't in Round 2.**
   - Set Round 2 `imgs:["caseFront","jdField","jdYard"]` (only Case IH and John Deere, matching "2 lots").
   - Remove `caseField` from `LOTS[0].imgs` → `["caseFront"]` (counter "1 / 1"). Change the gallery note to "Cab, tyre, engine and hour-meter photos requested from the seller."
4. **Home + Event · desktop · all · `jdFront` is used as the hero, the Row Crop mosaic lead and the event header lead.**
   - Hero stays `jd-front.jpeg`.
   - Row Crop event `imgs:["caseFront","jdYard","nhFront"]`.
   - Event `.ev-photo` uses the same order (`caseFront` large).
5. **Lot · all · the same lot is live at R 215 000 (14 bids) and also "opening R 200 000" in Round 2.**
   - Make the pre-start states a different lot: use `LOTS[1]` (John Deere 8R 410, `jdFront`/`jdField`/`jdYard`) relisted as "Lot 3 · Round 2".
   - Or keep lot 7 and rename the switcher to "Same layout, before start (illustrative)", and render a muted 13px line above the breadcrumb: "Preview: how this page looks before a sale opens."
   - The first option is preferred.
6. **Phone filter panel · phone · both · no way to see results or close the panel. With 0 matches, the empty state is hidden under the panel.**
   - Append to `.m-panel` a sticky footer: `<div style="position:sticky;bottom:-16px;background:var(--a-bg);padding-top:12px;display:grid;grid-template-columns:1fr 2fr;gap:8px"><button class="btn outline" data-act="clear">Clear</button><button class="btn primary" data-act="close-filters">Show ${list.length} lots</button></div>`.
   - `close-filters` sets `st.mf=false` and re-paints.
   - Give `.m-panel` `max-height:min(420px,70cqh)` and `z-index:5`.
7. **Lot · phone+desktop · both · the bid `<input>` hit area is 27px inside a 48px box that isn't clickable.**
   - Change `<div class="bid-input">` to `<label class="bid-input" for="${ids}">`.
   - Add `.bid-input input{height:100%;align-self:stretch}`.
8. **Event · phone · both · compact rows are about 250px tall with an empty column under the 120×90 thumbnail.**
   - Change `.lot.row` to `display:grid;grid-template-columns:120px 1fr;grid-template-areas:"ph b" "cta cta"`.
   - Move `.cta-row` out of `.lot-b` into the grid with `grid-area:cta;padding:0 12px 12px`.
   - Put the reserve pill on the same line as the price label (`.lot.row .price-row{flex-wrap:wrap}`) instead of its own `<div>`.
   - Target height is ≤ 190px.
9. **Event · phone · both · the terms grid is about 260px and the first lot starts at y≈720.**
   - Below 760px, render the terms as a 2-col `<dl>` with 8px 12px cell padding, drop the "Reserve" cell into the "Shown on each lot" pill on cards, and move "Full auction rules →" into the `.when` line as an inline link.
   - Or wrap the terms in `<details><summary>Sale terms: 5% + VAT premium, EFT within 48h</summary>…</details>`, closed by default on phones.
10. **Event · desktop · both · the header has about 110px of dead space above the badge, and the "when" line orphans "10:00 SAST, 2 minutes apart".**
    - In `.ev-head` use `align-items:start` and `padding-block:16px 28px`.
    - Set `.ev-head .when{max-width:60ch}` and wrap "Sat 22 Nov, 10:00 SAST" in `.nw`.
    - Add a 2-column fact row under the h1 to fill the left side: `4 lots · From R 180 000 · 4 sellers · Free State, Mpumalanga, KZN` (`.meta`, 14px).
11. **Lot · phone pre-start · both · the long uppercase badge "OPENS MON 24 NOV, 09:00 SAST" plus "Reserve price set" wraps to two rows and repeats the countdown directly below.**
    - Set the badge text to "Upcoming".
    - Set `S.note` to "Opens Mon 24 Nov, 09:00 SAST · closes Sat 29 Nov from 10:00 SAST".
12. **Lot · phone · both · the sticky bar uses `hidden` (display:none), so scrollHeight jumps by 65px each time the panel CTA crosses the threshold.**
    - Keep the bar in flow and use `.sticky-bid.off{transform:translateY(100%);visibility:hidden;transition:transform .15s}`. Toggle `classList.toggle("off",ratio>.9)` instead of `hidden`.
    - Add `@media (prefers-reduced-motion:reduce){.sticky-bid{transition:none}}`.
13. **Home + Lot · phone · both · section links wrap onto their own right-aligned line ("Read the auction rules →" under "How AgriBid works").**
    - Add `@container (max-width:759px){.sec-head>.link{margin-left:0;flex-basis:100%;min-height:32px}}` so the link left-aligns under the h2.
    - Or move the "How AgriBid works" link below `.steps` as `<a class="link" style="margin-top:16px">`.
14. **Home · phone · both · the hero photo is invisible (overlay 0.90/0.82).**
    - On phone use `.hero-ov{background:linear-gradient(180deg,hsl(var(--hero-h)/.35) 0,hsl(var(--hero-h)/.88) 45%,hsl(var(--hero-h)/.95))}`.
    - Give `.hero-in` `padding-top:160px` so the tractor shows above the headline.
    - Check headline contrast is still at least 4.5:1 at its top edge.
15. **Event · desktop · both · the Detailed/Compact toggle is decorative (static `aria-pressed`, no handler).**
    - Wire it: `data-act="view" data-v="compact|detailed"`, `st.view`, `eventScreen(fr, fr==="m"||st.view==="compact")`.
    - Or delete `.view` from `.tb-right`.
16. **Home · desktop · both · "Browse by make" with 5 rows in 2 columns leaves an orphan.**
    - Use `@container (min-width:760px){.makes{grid-template-columns:repeat(3,1fr)}}` and add a 6th row "All makes · 7 lots" linking to `#event`.
    - Or use 1 column at `max-width:640px`.
17. **Home · all · "1 lot · From R 238 000" on the Lichtenburg card although that lot has 6 bids.**
    - For 1-lot events render "1 lot · Current bid R 238 000".
    - For multi-lot events keep "From", computed from the lowest current or opening bid.
18. **Lot · all · the condition report has no provenance.**
    - Under the h2 add `<p class="hint">Inspected by AgriBid on Tue 11 Nov 2025 · Report ref on request</p>` (tag "Needs decision" in the notes, not the UI).
19. **Copy · event chips + lot history + home steps.**
    - Chip `"Up to "+st.hrs+" hrs"` → use the thin-space formatter: "Up to 2 000 hrs".
    - History "1 h ago" → "1 hr ago".
    - Step 3 title "Bid live or set a maximum" with its body about payment → retitle "Win, pay and collect", or change the body to "Bid as it happens or set a maximum and we bid for you in steps."
20. **Lot · registered pre-start · both · the increment chips under "Your maximum bid" are ambiguous (add to what?).**
    - In the `reg` state label the group "Raise your maximum by" (visible 12px label above `.inc`) and set aria-label accordingly.
21. **A11y · all.**
    - Add `name` to every input/select (e.g. `name="make"`, `name="hrs"`, `name="bid"`, `name="q"`). This clears 80 DevTools issues.
    - Drop `aria-current` from the nav "Auctions" link on Home; set it per screen.
    - Add `aria-live="polite"` to `.toolbar .cnt`. It's already `role=status`, but it's re-created on every paint, so render it once and update its textContent instead.
22. **Board chrome · 390 · both · the URL pill is crushed to "ag" and the viewport label is clipped ("scrolls sideways on small sc…").**
    - Add `@media (max-width:600px){.chrome .vp{display:none}.chrome .url{max-width:none}}`.
23. **Board · phone frame · both · the app renders at 368px (1440 board) and 336px (390 device), not 375.**
    - Set `.phone{max-width:none;width:auto;display:flex;justify-content:center}` and `.phone .app{width:375px;flex:none}`, with `scrollbar-gutter:auto` and `scrollbar-width:none` on `#app-m` so the content width is exactly 375.
    - At 390 board width let the phone frame scroll sideways like the desktop frame.
