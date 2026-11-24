# Runbook: import the webuytractors.shop catalogue

The demo shows real data from webuytractors.shop (owned by the AgriBid owner): the open Year End sale, the 5 most recent closed sales and the fixed-price listings. `scripts/import-wbt.ts` loads it into a Convex deployment; `seed:weeklyReset` then keeps it fresh.

## What it creates

| Source                       | Becomes               | Timeline (relative to now)                                         |
| ---------------------------- | --------------------- | ------------------------------------------------------------------ |
| The open auction (85 lots)   | a published sale      | opened 2 days ago, closes in 8 days (live)                         |
| The 22 fixed-price listings  | "Showroom stock" sale | opens in 1 day, closes in 9 (upcoming); opening bid = asking price |
| The 5 newest closed auctions | closed sales          | newest ended 3 days ago, then every 28 days                        |

- Sale names lose their day ranges and ordinal dates ("20-25 November Year End 2026 ..." becomes "Year End 2026 Auction", "25-29 September 2026 ..." becomes "September 2026 Auction") because the demo re-times sales; the original name is kept in the description. Placeholder makes ("Other", "Unknown") are stored blank and never become make chips.
- Lots with a terms/viewing/notice title, no real title or no usable photo are skipped. The source's "missing image" placeholder is ignored.
- Photos are downloaded, resized to at most 1600 px JPEG with `sharp` and uploaded to Convex file storage through `wbtImport:generateUploadUrl`. Lots hold the storage ids, lead photo first (at most 10).
- Sold lots keep the real winning price (excluding VAT and premium) and get ONE valid bid row from a synthetic demo bidder, so the bid history, winner and fee ledger are consistent. The bid counter is set to the source's real bid count. Unsold lots keep the best unmet bid as their price and have no bid rows. No other bids are invented for closed sales.
- Live lots open at the source opening bid. `weeklyReset` adds short bid histories and watchers (`mock-*` users) to about 12 live lots so the featured lot, bid counts and watching counts are populated. Only good machines are decorated: tractors first, then the dearest lots, with at least 4 photos and no "non runner", "spares" or "scrap" in the title or description, so the most-engaged (featured) lot is a good showcase.
- Unknown year and hours are stored as `0` (hidden in the UI, ignored by year and hours filters); an unknown make is stored as an empty string (the lot title is shown). Province is set only when it is unambiguous from the town.
- Every lot snapshots the 12% auction premium with `premiumSource: "auction"` and the 5% seller commission. The seeded fee rows stay inactive.
- The seller is a synthetic profile "We Buy Tractors" (`wbt-seller`, farming business, VAT registered). No phone, e-mail or address is stored; company details are never seeded.
- Idempotent: sales are keyed on `auctions.seedId` (`wbt:auction:<source id>`), lots on `lots.seedId` (`wbt:lot:<source item id>`, or the product page for listings). A re-run updates in place and only uploads photos for lots that do not have them all.

## Environment

| Variable                | Meaning                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `CONVEX_URL` (required) | Deployment URL, e.g. `https://agribid-convex.duckdns.org`   |
| `CONVEX_ADMIN_KEY`      | That deployment's admin key. Never print, log or commit it. |

The script calls only `internal` functions (`convex/wbtImport.ts`), which accept the admin key and nothing else. The scrape (`wbt-data.json`, 14 MB) stays outside the repo.

## Run it

1. Deploy the functions and schema first (`auctions.seedId` is new): `bunx convex deploy` (production: the self-hosted deploy flow in `docs/architecture/overview.md`).
2. Set the variables in your shell (read the key from where you keep it; do not echo it).
3. Import: `bun scripts/import-wbt.ts C:/path/to/wbt-data.json`. It prints sales, lots created/updated and photos uploaded/failed. The last step schedules the re-time, so the live sale is live straight away.
4. Run `bunx convex run seed:weeklyReset` once (idempotent) so the reference seed and counters are current.

### Local anonymous deployment (what reviews use)

`CONVEX_AGENT_MODE=anonymous bunx convex dev`, set `ALLOW_PII_DEV_FALLBACK=true` and `CLERK_JWT_ISSUER_DOMAIN` with `bunx convex env set` (see `LESSONS.md`), then take the key from the git-ignored `.convex/local/default/config.json` without printing it:

```bash
export CONVEX_URL=http://127.0.0.1:3214
export CONVEX_ADMIN_KEY=$(node -p "require('./.convex/local/default/config.json').adminKey")
bun scripts/import-wbt.ts /path/to/wbt-data.json
```

## Retire the old US demo data (one-off, production)

The old seed's lots (their `seedId` is set and does not start with `wbt:`) and its seven sales (exact old title, no `seedId`) are not touched by `weeklyReset`. Review and delete them explicitly:

```bash
bun scripts/import-wbt.ts x --retire-old-demo           # dry run: lists every row it would delete
bun scripts/import-wbt.ts x --retire-old-demo --apply   # deletes exactly that list
```

Lots with no `seedId` (created by real users) and every other sale are never deleted. Related bids, proxy bids, fee rows, flags and watch data of the deleted lots go with them.

## What `seed:weeklyReset` does now

It deletes nothing. It re-applies the insert-if-absent reference seed, then re-times every sale that has an `auctions.seedId` to its place on the timeline, resets bidding on the live and upcoming sales (only `mock-*` bids and watches are removed; a lot a real person has bid on is left alone), shifts closed sales' settle times and re-adds the demo bids. Photos and the catalogue are never touched. With nothing imported it only runs the reference seed. Work is scheduled in batches of 100 lots per sale to stay inside Convex mutation limits.

## Rollback

Imported rows are identified by the `wbt:` `seedId` prefix. Deleting a sale does not delete its lots; remove the catalogue with the admin tools, or `seed:clearAuctions` on a non-production deployment.
