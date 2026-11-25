# Confirmed design decisions (page-by-page iteration)

Each page starts from every decision below. Add new ones as the owner confirms them, dated.

**Process rules (owner, 2026-11-23):**

- "Locked" means the current best, not frozen. When a later page finds a better pattern, apply it back to earlier pages, show the owner the before/after, and record it here with a date.
- One UI design document says exactly what the styling is: `docs/architecture/ui-design/design-system.md`, covering tokens, type, spacing, and every component with its spec, states and the pages that use it.
- Reuse components everywhere. The mockups are built from one shared component kit, and each kit component maps 1:1 to a component in `src/components/ds/`.

## Platform-wide (2026-11-22)

- **Buyer's premium:** 12% + VAT by default, configurable in Admin settings.
- **Closing:** all lots close at the auction close time. A bid in the final 2 minutes extends that lot's close by 2 minutes (anti-snipe soft close).
- **Registration fee:** Admin decides whether a fee applies and the amount (old site charged R5 000).
- **Featured lot on Home:** the lot with the most engagement (watchers + bids + views), not an admin pick.
- **Approved features:** search + make chips on Home; watch heart on each lot card; fee line in the sale block; state-aware CTA ("Register to bid" for guests, "My bids" for registered users, outbid badge); sticky phone bar after the hero ("Closes in … · Register to bid"); share lot to WhatsApp; auction-finance pre-approval link.
- **VAT basis:** 15% VAT on the premium always, and on the bid only when the seller is VAT-registered (updated 2026-11-23). R400 000 bid from a VAT seller → R515 200; from a private seller → R455 200. Show a worked total.
- **Seller costs (placeholders, all admin-configurable):** 8% seller commission + VAT, no listing fee, paid within 7 days of the buyer's payment.
- **Registration deposit (admin-configurable on/off + amount):** default R5 000, refundable if you don't buy. Show "Have ready: ID + proof of address".
- **Wording:** keep "lots" (auction term).
- **Finance contact:** admin setting; demo value Lee-Anne Vermeulen, com-fin (083 277 0178) from the old site.
- **Transport:** "Request a transport quote" form that goes to the AgriBid team (no partner yet).
- **Afrikaans:** out of scope.
- **Reserve wording (2026-11-22):** before any bid "Reserve applies" (neutral); after bids "Reserve not met" (warn) / "Reserve met" (ok); "No reserve".
- **Phone contact:** WhatsApp lives in the sticky bar once it shows, on Home, sale and lot pages (on the lot page it sits next to the bid bar); call icon in the phone header; no floating buttons covering content. WhatsApp is the green logo only, no text label (aria-label for accessibility).
- **Muted text token:** darker `--muted-foreground` in both themes for sunlight legibility.
- **Content rules:** every word must earn its place; no taglines or decorative subtitles. Mobile-first (375px); desktop consistent in style.
- **Demo data:** real lots/photos from webuytractors.shop (owner's site); few lots is fine.
- **Footer legal details** come from Admin settings only; never placeholder or fictional numbers in the app.

## Home

- Round 1 (`rounds/home-r1.html`): direction accepted (lots-first, real sale as headline, no slogan, short page). Reviewed by farmer persona (`rounds/home-r1-farmer-review.md`).
- Round 2 brief: farmer top 8 (floating WhatsApp/call, worked total, deposit + docs, visible Sell, viewing/collection + transport quote, legibility, equipment-type chips, plain-words soft close/opening bid + finance contact) plus phone grid price alignment, heart contrast, drop "6 more lots", multi-sale state, sticky bar.
- Round 3 (`rounds/home-r3.html`): owner-approved candidate. Reserve explainer shortened to "The seller's minimum price. Each lot shows whether it's met." Sent for farmer, then marketing-executive review before locking.
- **LOCKED 2026-11-22: Round 4 (`rounds/home-r4.html`, notes `home-r4-notes.md`) is the approved Home design.** Owner answers: free valuation offer YES ("WhatsApp us 3 photos for a free valuation"); deposit refund default 3 working days (admin-configurable); no "Formerly We Buy Tractors".

## Auction event page (2026-11-22)

- **Remind me** (upcoming sales): push notifications; Admin can enable/disable the feature.
- **iPhone push (option A, 2026-11-22):** iOS Safari only allows web push for a site added to the Home Screen. When an iPhone user in plain Safari taps Remind me, show a short "Add AgriBid to your Home Screen" guide sheet (Share → Add to Home Screen, then open AgriBid from the icon), then ask for notification permission from the Home Screen app. Push only, no SMS/email fallback. Android and desktop go straight to the permission prompt.
- **Lot numbers:** assigned in order as lots are added to a sale (1–N); default sort is Lot number.
- **Closed sales:** publish sold prices (including sold subject to confirmation).
- ~~**VAT:** always on bid + premium, regardless of seller VAT status.~~ Superseded 2026-11-23: VAT on the premium always, and on the bid only for VAT-registered sellers (see Lot page).
- Round 1 (`rounds/event-r1.html`) reviewed; round 2: share icon (not WhatsApp logo) for sharing, viewing/collection line in the header, drop header trust line, draw "Show 24 more".
- **LOCKED 2026-11-23: Round 2 (`rounds/event-r2.html`) plus the round 3 iPhone Home Screen sheet (`rounds/event-r3.html`, frames `phone-a2hs`, `phone-a2hs-done`) is the approved Auction event page.**

## Lot page (2026-11-22)

- **LOCKED 2026-11-23: Round 3 (`rounds/lot-r3.html`, notes `lot-r3-notes.md`) is the approved Lot page.** One change: remove the "Cold-start video" row from Condition, because the video is already first in the gallery. Reviewed by the marketing persona (`rounds/lot-r2-marketing-review.md`).
- **Maximum (proxy) bid:** skipped. Not in v1; remove "+ Set a maximum bid" from the design.
- **Confirm sheet:** before every bid, showing bid + premium + VAT = "If you win, you pay".
- **Bid steps:** show only the next minimum bid (and quick-bid amounts); no increment table in Fees & rules.
- **Minimum photos per lot:** admin-configurable, default 8; a lot can't go live with fewer.
- **VAT basis (2026-11-23):** this SUPERSEDES "VAT always on bid + premium" in the Platform-wide and Event sections.
  - VAT is charged on the buyer's premium for every lot.
  - VAT is charged on the bid only when the seller is VAT-registered.
  - Example, R 400 000 bid:
    - VAT seller: (400 000 + 48 000) × 1.15 = R 515 200
    - private seller: 400 000 + 48 000 + 7 200 = R 455 200
  - Each lot shows its seller's VAT status, and the worked total and confirm sheet follow it.
  - The locked Home and Event examples use a VAT-registered seller's lot, so their totals stay correct. Their "12% premium + 15% VAT" lines and the Fees & rules sheet need the wording updated.
- **Deposit:** the R 5 000 deposit counts towards payment when you win.
- **Reserve not met at close:** the lot goes to **"Under consideration"**. The seller can choose to accept the top bid. Bidders see that status instead of Sold or Not sold. The seller has **48 hours** to decide (owner, 2026-11-23); after that the lot is Not sold.
- **Inspection:** AgriBid does not inspect machines. Condition claims are always labelled "Seller says:". Never show "Inspected by AgriBid".

## Register / sign-in / deposit (2026-11-24)

- Round 1 (`rounds/register-r1.html`, notes `register-r1-notes.md`): 4 steps (Details, ID, Address, Deposit; 3 when the deposit is off), one status page for pending / rejected / deposit received / approved, "Finish registration · Step n of 4" on lot pages. Owner answers:
  - **Deposit payment:** manual EFT. Each buyer gets a unique reference; "I've paid" or proof on WhatsApp; admin marks it received. No payment gateway.
  - **Pay before approval:** yes, both can happen at once. Bidding opens when documents are approved AND the deposit is received.
  - **Review time:** "within 2 business days".
  - **Proof of address:** utility bill, bank statement or lease, not older than 3 months, photo or PDF.
  - **Foreign buyers:** accept a passport as well as a 13-digit SA ID.
  - **Bank details:** come from Admin settings (never hard-coded or invented).
  - **Rejected documents:** the buyer replaces only the rejected document; no limit on tries.
  - **Refunds and expiry:** the deposit is refunded to the same account it came from; unfinished registrations never expire.
  - **Mobile number:** "We call you about lots you win." confirmed.
- **LOCKED 2026-11-24: Round 2 (`rounds/register-r2.html`, notes `register-r2-notes.md`) is the approved Register / sign-in / deposit design.** It adds the SA ID / Passport choice, the passport photo page upload, "within 2 business days", replace-only-the-rejected-document, and the same-account refund line. Fix in build: the header avatar initials follow the signed-in user.

- **Build decisions (owner, 2026-11-24):**
  - **Existing verified buyers:** no waiver. When the deposit setting is on, they must pay the deposit before they can bid again.
  - **Copy not in the frames (approved):**
    - Lot page, a document was rejected: "One document needs replacing." with the button "Replace document".
    - Lot page, deposit not yet received: "Pay your R 5 000 deposit to bid." with the button "Pay deposit".
    - Step 3 button when the deposit is off: "Send documents".
    - Bank details not set: "Bank details aren't set up yet. WhatsApp us and we'll send them."
  - **Desktop side card:** drop "Seller ID checked (FICA)" and "Inspection photos on every lot".
  - **Release order:** keep the registration deposit switched off on prod until the admin deposit page (WP4) is live, then switch it on with the owner.

## Watched-lot alerts (2026-11-24, D9b)

- **Outbid alert:** only to bidders who also watch the lot.
- **Permission:** ask for notification permission right after the heart tap (when not yet granted).
- **Admin switch:** a separate on/off setting from sale-open reminders.
- Alerts: "You've been outbid" and "Closing in 1 hour" for watched lots. The watching toast promises them only when the user has a push subscription and the setting is on.

## My bids (2026-11-25)

- Round 1 (`rounds/mybids-r1.html`, notes `mybids-r1-notes.md`). Owner answers, all as recommended:
  - **Tabs:** Watching is a tab of My bids (Bidding · Won · Lost · Watching).
  - **Auto-watch:** placing a bid automatically watches the lot.
  - **Deposit:** credited once, against the first won lot's payment.
  - **Payment reference:** each won lot has its own reference (e.g. `AB-1042`).
  - **Collection details:** the seller phone and collection address show only after payment is confirmed.
  - **Countdown colours:** amber under 1 hour, red under 10 minutes.
  - **Payment deadline:** a winner must pay within 2 business days.
  - **Under consideration:** the lot stays under Bidding ("With the seller") until the seller decides.

## Account and seller page (2026-11-25)

- Round 1 (`rounds/profile-r1.html`, notes `profile-r1-notes.md`). Keep two pages: Account replaces `/settings` and `/kyc`; the public seller page stays separate. Owner answers:
  - **Deposit refund:** "Ask for refund" in Account, only when the buyer has no unpaid won lots.
  - **Seller name:** the business name, otherwise first name plus surname initial.
  - **Reviews:** hidden until the seller has at least 3.
  - **Message seller:** removed.
  - **Bio:** admin-moderated.
  - **Notifications:** only the 3 push switches; the old email, SMS and proxy-bid settings are dropped.
  - **Public URL:** a name slug, not the Clerk userId.
  - **Account deletion (POPIA):** a later round.
- **Round 2 layout (owner):**
  - Account sections go in order of how often they're used. Selling comes before Notifications.
  - Rework the seller page layout. "Report this seller" becomes a flag icon in the corner.
- **LOCKED 2026-11-25: Round 2 is the approved design for My bids (`rounds/mybids-r2.html`) and for Account and seller page (`rounds/profile-r2.html`).** Round 2 answers (all as recommended):
  - **VAT on the seller page:** "VAT registered" only for VAT sellers; other sellers show "Private seller".
  - **Seller type:** left off the public header; it shows in Account only.
  - **Report reasons:** misleading listing, suspected fraud, offensive content, other.
  - **Slug clashes:** add `-2` to the second one. A slug is set once and stays; after a rename, the old slug redirects.
- **Fix in build:**
  - The empty gap and double divider above "Sell equipment" in `account-buyer`.
  - The seller-page countdown follows the shared demo clock.
  - No blank line between the title and the meta on seller lot cards.

## Link previews (2026-11-22)

- Owner: the current share preview is bad. Root causes:
  - `og:image` and `og:url` point at agribid.co.za, which doesn't resolve, so there's no image.
  - The text is a tagline ("built for farmers, by farmers").
  - The SPA sets per-page tags with react-helmet, which WhatsApp and Facebook crawlers never run, so every link looks the same.
  - The favicon is vite.svg.
- Direction: per-page previews served to crawlers (sale and lot pages get their own photo, name, price and close time), absolute URLs on the live domain, no taglines. Design the preview cards like any other page.
- **Approved 2026-11-23 (owner: "much better"):** Round 1 (`rounds/share-r1.html`) previews and the icon (cream Lora "A" on brand green, 180/32/16) are approved, with two changes:
  - Remove "Farm equipment auctions" from the home preview image; it stays in og:title only. The image shows the wordmark and "Live now".
  - The sale collage uses the 3 lots with the most engagement, the same rule as Home's featured lot.

### Home patterns carried to every page

- Hero/primary CTA "Register to bid" filled; secondary outline. Sticky phone bar: countdown | WhatsApp logo | primary CTA.
- Lot card: photo (heart on solid circle), title (no year), meta "year · hours · town" (omit unknowns), reserve pill, "Opening bid"/"Current bid" 14px, price, then "n watching" or "n bids". Prices align across a row.
- Worked total tied to a real lot ("e.g. <lot>: bid R X → pay R Y", 12% premium + 15% VAT · Fees & rules).
- Deposit: "R 5 000 deposit, refunded within 3 working days if you don't buy" / "Have ready: ID + proof of address".
- Trust line: "Seller ID checked (FICA)" · "Inspection photos on every lot".
- Filters: categories with counts, Price chip (bottom sheet), makes row with counts; hide empty.
- Relative close times ("Closes in 1d 3h") with absolute date as secondary ("Tue 25 Nov, 11:00", no "SAST").
- Seller strip below the lots: free-valuation copy. Footer: entity, address, 083 7 000 000, WhatsApp logo, legal links; Reg./VAT only when set.
