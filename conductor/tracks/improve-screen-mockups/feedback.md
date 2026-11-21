# Executive design review (CMO persona, Opus) — 2026-11-20

Source: screenshots in `./screenshots/` (local self-hosted Convex seed, so photos are placeholders and some copy is test data).

## Verdict

- Solid but generic: competent SaaS template, not yet a place a farmer spends R2m.
- Trust gap: no buyer's premium / VAT / reserve / inspection / collection / payment info; seller card shows "0 Items Sold"; empty "Headquarters" footer heading.
- Conversion stalls at intent: pre-start lots end in grey "Not Started" / "Bidding Not Yet Open"; on mobile the bid panel and seller card sit below related lots.

## Home

1. Value-prop hero (≤280px desktop / 220px mobile): "South Africa's online auction floor for serious farm machinery" / "Verified sellers. Inspected equipment. Every bid on the record." CTAs "Browse live auctions" + "Sell your equipment"; proof strip: FICA-verified sellers · Condition-reported lots · Anti-sniping soft close. No stats until real.
2. Event cards sell the sale: 16:9, 3-photo mosaic of lead lots, status badge on every card ("● LIVE" / "Opens Thu 20 Nov"), "Closes in 5d 23h" chip; title → one-line summary → "Free State · 5 lots · From R 46 000" → "Lots close from Wed 26 Nov, 10:00 SAST" + "View lots →". Description max one line.
3. One segmented control "Live & upcoming | Closing soon | Results" + sort "Closing soonest". Drop "All Auctions"; Sell lives in header as "Sell equipment".
4. Search back on mobile (icon + full-width field "Search make, model or category"); "Login / Register" → "Sign in" on mobile.
5. "Closing soon across all auctions" lot rail + category tiles (Tractors · Combines · Planters · Sprayers · Loaders & Telehandlers · Tillage).
6. "How AgriBid works" 3 steps above footer + "Read the auction rules".

## Auction event

1. Sale-summary header instead of 290px empty banner: title, "Online auction · Opens Thu 20 Nov, 21:30 SAST · Lots close from Mon 24 Nov, 10:00 (staggered)", countdown card "Bidding opens in 1h 59m" + "Remind me". Hide "Published". Sale terms row: buyer's premium · payment EFT 48h · viewing · collection 7 days + "Full auction rules (CPA)". Buyer's premium needs a business decision.
2. State-driven CTA instead of disabled "Not Started": guest pre-start "Register to bid"; registered pre-start "Set max bid" + "Remind me"; live "Bid R 217 500".
3. Scannable card: "LOT 12 · Tractor" eyebrow, title make/model only ("2022 Case IH Magnum 380"), "820 hrs · 380 hp · Bothaville, FS", "Opening bid" vs "Current bid" consistently, "R 200 000" (no cents, tabular), reserve pill, non-monospace countdown.
4. Persistent 260px filter sidebar + 3-column grid aligned to header edge; toolbar "5 lots" · sort · Detailed/Compact. Mobile sticky "Filters (2)" / "Sort".
5. Mobile compact: 4:3 thumb, neutral countdown (amber only <1h), no italic description, ≥44px green CTA.
6. Never show a grey 1216×290 box; use lead-lot photo/mosaic.

## Lot detail

1. Bid panel in decision order: status pill → "Opening/Current bid" R 200 000 excl. VAT → reserve pill → countdown (red <2 min) + soft-close note → bid input with +increment chips → "Place bid R 202 500" / "Set max bid" / "Register to bid" → collapsible fee breakdown with est. total → trust footer.
2. Mobile order: gallery → title/specs → price/countdown → spec table → condition → seller → bid history → description → related. Sticky bar matches state ("Opening bid R 200 000 · Opens 1h 59m | Set max bid").
3. Gallery first (top-left desktop, 4:3), 6–8 labelled angle thumbs (Front · Engine · Cab · Rear · Tyres · Hour meter); drop the grey "Auction Starts" bar.
4. Specifications key/value table + condition report traffic lights from `conditionChecklist`, "Download full inspection PDF" (`conditionReportUrl`), "Book a viewing".
5. Seller card: "Sold by [Business]" + FICA verified, location, response time; hide sales count under 3 ("New seller · Identity & business verified"); "Ask the seller" outline + "View profile" link.
6. H1 "2022 Case IH Magnum 380"; chips "Lot 12 · Row Crop Tractor Sale"; no DB hash IDs; "♡ Watch (23)".
7. Bid history inline (last 3 + "View all"), empty state "No bids yet. Opening bid R 200 000."; "More from this auction" + "Similar tractors"; optional finance lead link.

## Cross-cutting

1. Actually load Lora for headings (documented in theme.md, not loaded in index.html); tabular Inter for prices/countdowns; no monospace timers.
2. Footer honesty: fill or remove Headquarters; address, reg no., VAT no., phone, WhatsApp, hours. Specific claim "Every seller FICA-verified before listing."
3. Money: "R 200 000" no cents; Opening bid / Current bid / Sold for; VAT + premium near price; estimated total.
4. One status system: ● Live (green) · Opens [date] (amber) · Closing soon (red) · Sold (blue) · Passed in (grey). No status in titles, no internal states/IDs, no seconds in dates.
5. Photography standard: 16:9 events, 4:3 lots/gallery, labelled angles, branded empty-image state.

## Data notes

Exists already: reserve price, min increment, `conditionChecklist`, `conditionReportUrl`. Needs decision/new fields: buyer's premium, seller response time, watcher count, finance estimate, province.
