# Task: Implement GitHub issue #219 — granular verification status fields

## Context

GitHub issue #219 (https://github.com/marcojsmith/AgriBid/issues/219) asks for
per-field verification status on seller profiles. Today the Trust & Compliance
section on the profile page (`src/pages/Profile.tsx`, `getTrustItems()`) hardcodes 4
of 5 trust items as permanently unverified — only "Identity" is real, driven by
`isVerified`/`kycStatus`. This task wires up real `emailVerified`/`phoneVerified`/
`bankingVerified`/`taxNumberVerified` fields end to end: schema → query → handler →
frontend.

Read `convex/schema.ts`, `convex/auctions/queries/browse.ts` (`getSellerInfoHandler`/
`getSellerInfo`), `convex/users.ts` (`verifyUserHandler`), and `src/pages/Profile.tsx`
(`getTrustItems`) fully before editing — this task gives you exact current line
context but re-verify against the live file since other work may have landed since
this was written.

## Instructions

### 1. `convex/schema.ts` — add fields to the `profiles` table

Add these four optional boolean fields to the `profiles` table definition (alongside
the existing `bio`/`companyName`/`location` fields):

```typescript
emailVerified: v.optional(v.boolean()),
phoneVerified: v.optional(v.boolean()),
bankingVerified: v.optional(v.boolean()),
taxNumberVerified: v.optional(v.boolean()),
```

No new indexes needed — these are display-only booleans, not queried on directly.

### 2. `convex/users.ts` — set `emailVerified` on KYC approval

In `verifyUserHandler` (around line 366-406), when the admin approves a user (the
`ctx.db.patch(profile._id, { isVerified: true, updatedAt: now })` call around line
392), also set `emailVerified: true` if the profile has a `kycEmail` set (the
encrypted KYC email submitted during `submitKYC` — see `submitKYCHandler` earlier in
the file for where `kycEmail` gets populated). Concretely:

```typescript
if (!profile.isVerified) {
  await ctx.db.patch(profile._id, {
    isVerified: true,
    ...(profile.kycEmail ? { emailVerified: true } : {}),
    updatedAt: now,
  });

  await updateCounter(ctx, "profiles", "verified", 1);
}
```

Don't touch `phoneVerified`/`bankingVerified`/`taxNumberVerified` here — per the issue,
those require separate flows (OTP, payment integration, manual admin process) that are
explicitly out of scope for this ticket. They should just default to `undefined`/falsy
until those features exist.

### 3. `convex/auctions/queries/browse.ts` — return the new fields from `getSellerInfo`

- In `getSellerInfoHandler`'s return object (around line 415-428, where it returns
  `name`, `isVerified`, `role`, etc.), add:
  ```typescript
  emailVerified: profile.emailVerified,
  phoneVerified: profile.phoneVerified,
  bankingVerified: profile.bankingVerified,
  taxNumberVerified: profile.taxNumberVerified,
  ```
- In the `getSellerInfo` query's `returns` validator (the `v.object({...})` around
  line 442-454), add the matching validators:
  ```typescript
  emailVerified: v.optional(v.boolean()),
  phoneVerified: v.optional(v.boolean()),
  bankingVerified: v.optional(v.boolean()),
  taxNumberVerified: v.optional(v.boolean()),
  ```

### 4. `src/pages/Profile.tsx` — wire `getTrustItems()` to real data

`getTrustItems` (around line 111) currently takes `(isVerified: boolean, kycStatus?:
string)` and hardcodes Banking/Phone/Email/Tax Number/Seller Rating. Extend its
signature to accept the new fields (from `sellerInfo`, the `getSellerInfo` query
result already used at the call site around line 250: `getTrustItems(sellerInfo.isVerified)`),
and replace exactly these four hardcoded values:

- **Banking** (`value: "Not linked"`, `verified: false`) → drive from
  `sellerInfo.bankingVerified`: `value: bankingVerified ? "Linked" : "Not linked"`,
  `verified: bankingVerified ?? false`.
- **Phone** (`value: "Pending"`) → drive from `sellerInfo.phoneVerified`:
  `value: phoneVerified ? "Verified" : "Pending"`, `verified: phoneVerified ?? false`.
- **Email** (`value: "Pending"`) → drive from `sellerInfo.emailVerified`:
  `value: emailVerified ? "Verified" : "Pending"`, `verified: emailVerified ?? false`.
- **Tax Number** (`value: "Pending"`) → drive from `sellerInfo.taxNumberVerified`:
  `value: taxNumberVerified ? "Verified" : "Pending"`, `verified: taxNumberVerified ?? false`.

**Do NOT touch "Seller Rating"** (`value: "No reviews"`) — that's tracked by issue
#221 (seller review/rating system), a separate, unimplemented feature; leave it
hardcoded exactly as-is.

Update the call site (`getTrustItems(sellerInfo.isVerified)` around line 250) to pass
the new fields through, e.g. `getTrustItems(sellerInfo.isVerified, sellerInfo.kycStatus,
{ emailVerified: sellerInfo.emailVerified, phoneVerified: sellerInfo.phoneVerified,
bankingVerified: sellerInfo.bankingVerified, taxNumberVerified: sellerInfo.taxNumberVerified })`
— adjust the exact parameter shape to whatever's cleanest against the existing
function signature style in this file; check whether `kycStatus` is even currently
passed at the call site (the issue implies it might not be) and wire it through too if
missing, since `getTrustItems` accepts it as a parameter already.

Do not touch the "Complete Verification" button or its `title="Coming soon - see issue
#219"` — that button is out of scope for this ticket (it's about the OTP/payment/manual
flows that don't exist yet, not the display of current status).

## Constraints

- Follow `.claude/rules/convex_rules.md`: include argument/return validators on all
  touched Convex functions, no `any` types.
- Keep changes minimal and scoped to exactly the 4 files/behaviors above — this is a
  narrow, already-scoped issue; don't refactor unrelated code in these files.
- No `any` types in any new/edited code (TypeScript strict).
- Check `convex/auctions/queries/browse.test.ts` and any `Profile.test.tsx` for
  existing tests covering `getSellerInfo`/`getTrustItems` — update fixtures to include
  the new fields where they construct a seller/profile object, and add test coverage
  for: (a) `getSellerInfoHandler` returns the new fields from the profile doc, (b)
  `verifyUserHandler` sets `emailVerified: true` only when `kycEmail` was present, (c)
  `getTrustItems` renders "Verified"/`verified: true` when a field is true and
  "Pending"/"Not linked" otherwise (matching each item's existing wording).

## Verification

1. `bun run type-check` — zero errors.
2. `npx convex dev --once` (or `bun run type-check` covers the Convex side too, but
   also confirm the schema change deploys cleanly against the local dev deployment) —
   should succeed with no schema/validator errors.
3. `bun run test --run` (full suite) — all green, including any tests you added/updated.
4. `bun run lint` — zero errors, no new warnings.
5. Manually re-read the final `getTrustItems` diff and confirm "Seller Rating" is
   untouched and the "Complete Verification" button/title is untouched — both are
   explicitly out of scope.

## Results

### Files changed (7 files, +201/−10, version 0.10.0 → 0.10.1)

**Backend**

- `convex/schema.ts` — added `emailVerified`, `phoneVerified`, `bankingVerified`,
  `taxNumberVerified` (all `v.optional(v.boolean())`) to the `profiles` table, after
  `location`. No new indexes (display-only booleans, per scope).
- `convex/users.ts`
  - `verifyUserHandler`: KYC-approval patch now includes
    `...(profile.kycEmail ? { emailVerified: true } : {})` — email is verified only
    when the encrypted KYC email (set by `submitKYCHandler`) existed. `phoneVerified`/
    `bankingVerified`/`taxNumberVerified` deliberately untouched (OTP/payment/manual
    flows are out of scope per the issue).
  - `ProfileValidator`: added the same 4 optional booleans. **Not in the original
    scope, but required**: Convex object validators throw on undeclared properties for
    `returns` too (confirmed in the docs), and `getMyProfileHandler` /
    `getProfileForKYCHandler` return whole profile docs through this validator —
    without syncing it, both would start failing at runtime once any profile doc
    carries a new field.
- `convex/auctions/queries/browse.ts` — `getSellerInfoHandler` return object and the
  `getSellerInfo` `returns` validator gained the 4 verification fields. Also added
  `kycStatus: profile.kycStatus` (+ validator) here: the task instructed wiring
  `kycStatus` through the call site, but `sellerInfo.kycStatus` did not previously
  exist, so it had to be returned by the query for that instruction to be possible.
  This also makes the Identity trust item correct when `kycStatus === "verified"` but
  `isVerified` is still false.

**Frontend**

- `src/pages/Profile.tsx` — added a `VerificationStatus` interface; `getTrustItems`
  now takes `(isVerified, kycStatus?, verification?: VerificationStatus)`. Banking
  shows `Linked`/`Not linked`, Phone/Email/Tax Number show `Verified`/`Pending`, each
  `verified: <field> ?? false`, driven by `sellerInfo`. Call site passes
  `sellerInfo.kycStatus` + the 4 fields (previously only `isVerified` was passed, and
  `kycStatus` was silently dropped). **Seller Rating and the "Complete Verification"
  button (`title="Coming soon - see issue #219"`) are untouched — confirmed by diff.**

**Tests (written first; 4 failed against the old code as expected, then green)**

- `convex/users.test.ts` (+2): `verifyUserHandler` sets `emailVerified: true` when
  `kycEmail` is present; patch args are exactly `{ isVerified, updatedAt }` (no
  `emailVerified` key, via `toStrictEqual` with a pinned `Date.now` spy) when absent.
- `convex/auctions/queries/browse.test.ts`: fixture now includes `kycStatus` + the 4
  fields (mixed true/false to prove pass-through); the "missing optional fields" test
  asserts all 5 are `undefined` for a bare profile.
- `src/pages/Profile.test.tsx` (+3, fixture extended): all fields verified → `Linked`
  rendered, no `Not linked`/`Pending` anywhere; all unverified → `Not linked` + exactly
  3 × `Pending` (Phone/Email/Tax) + `No reviews` (Seller Rating untouched); mixed
  (`isVerified: false`, only `emailVerified: true`) → exactly 1 × `Verified` (Email),
  3 × `Pending` (Identity/Phone/Tax), `Not linked` (Banking).

### Verification output

1. `bun run type-check` — ✅ zero errors.
2. `npx convex dev --once` — ✅ `✔ Convex functions ready! (5.44s)` — schema deployed
   cleanly against the local dev deployment, no schema/validator errors.
3. `bun run test --run` — ✅ `Test Files 166 passed (166)`, `Tests 1997 passed (1997)`.
4. `bun run lint` — ✅ 0 errors (`No lint issues found.`). Per-file eslint on all 7
   touched files shows only pre-existing warnings on untouched lines (JSDoc param
   descriptions, `require-await` in old tests, pre-existing `no-secrets`/mock-factory
   `any` warnings); no new warnings introduced. Note: `prettier --check` reports every
   .ts/.tsx file in the repo (touched or not) due to CRLF checkout (`core.autocrlf=true`)
   vs Prettier's LF default — pre-existing environmental condition, not addressed here.
5. ✅ Manually re-read `git diff src/pages/Profile.tsx` — "Seller Rating" item and the
   "Complete Verification" button/title do not appear in the diff (untouched).
