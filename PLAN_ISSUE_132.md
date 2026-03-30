# Plan: Issue #132 - Admin Page for Managing Business Info

## Overview

Create an admin interface for managing business/organization information that will be used for SEO structured data (JSON-LD). Currently, `ORGANIZATION_SCHEMA` in `src/lib/seo.ts` has hardcoded placeholder values that need to be replaced with admin-managed data.

---

## Key Design Decisions

### Storage approach for `sameAs` (social links array)

The existing `settings` table schema stores `value` as `v.union(v.string(), v.number(), v.boolean())` — it cannot hold arrays. Two options:

- **Option A (recommended):** Store `sameAs` as a JSON-serialized string (e.g., `JSON.stringify([...])`) under key `"business.sameAs"`. Deserialize on read. Keeps all business info in the same table with the same upsert pattern as `updateSeoSettings`.
- **Option B:** Add a new dedicated `businessInfo` table with first-class array support. Cleaner types, but adds schema complexity and diverges from the established key-value pattern.

**Go with Option A** — consistent with the existing `settings` pattern and avoids a schema migration risk.

### Naming convention for settings keys

Follow the `SEO_KEYS` pattern: define a `BUSINESS_KEYS` const object mapping field names to their string keys (e.g., `"business.name"`, `"business.telephone"`). All keys prefixed with `"business."` to namespace them clearly.

### Query visibility

`getSeoSettings` is a **public** query (Layout reads it for all visitors). `getBusinessInfo` should also be **public** for the same reason — `src/components/Layout.tsx` needs it to inject the JSON-LD `<script>` tag.

---

## Checklist

### Phase 1: Database Schema & Backend

- [ ] **1.1** No schema change needed — reuse existing `settings` table. Confirm the `by_key` index already exists (it does). Document that `sameAs` will be stored as a JSON string under key `"business.sameAs"`.

- [ ] **1.2** Add `BUSINESS_KEYS` const to `convex/admin/settings.ts` — one key per field:

  ```ts
  const BUSINESS_KEYS = {
    businessName: "business.name",
    businessDescription: "business.description",
    streetAddress: "business.streetAddress",
    addressLocality: "business.addressLocality",
    addressCountry: "business.addressCountry",
    postalCode: "business.postalCode",
    telephone: "business.telephone",
    email: "business.email",
    website: "business.website",
    logoUrl: "business.logoUrl",
    sameAs: "business.sameAs", // stored as JSON string
  } as const;
  ```

- [ ] **1.3** Create public query `getBusinessInfo` in `convex/admin/settings.ts` — mirrors `getSeoSettings` pattern:
  - Reads all `BUSINESS_KEYS` from the settings table via `Promise.all`
  - Returns typed object with `v.union(v.string(), v.null())` for each field, and `v.union(v.array(v.string()), v.null())` for `sameAs` (deserialize from JSON)

- [ ] **1.4** Create mutation `updateBusinessInfo` in `convex/admin/settings.ts` — mirrors `updateSeoSettings` pattern:
  - All args `v.optional(v.string())`, except `sameAs: v.optional(v.array(v.string()))`
  - Call `requireAdmin(ctx)` at the top
  - Serialize `sameAs` to JSON string before upsert
  - Call `logAudit` with `action: "UPDATE_SETTING"`, `targetType: "setting"`
  - Returns `v.object({ success: v.boolean() })`

- [ ] **1.5** Export both functions in `convex/admin.ts` (the barrel file):
  - Add `getBusinessInfo` to the `queries` re-export list
  - Add `updateBusinessInfo` to the `mutations` re-export list
  - Note: the barrel file is `convex/admin.ts`, **not** `convex/admin/index.ts`

---

### Phase 2: Frontend Admin Page

- [ ] **2.1** Create `src/pages/admin/AdminBusinessInfo.tsx` — follow `AdminSEOSettings.tsx` pattern:
  - Use `useQuery(api.admin.getBusinessInfo)` to load current values
  - Use `useMutation(api.admin.updateBusinessInfo)` to save
  - Form fields: businessName, businessDescription, streetAddress, addressLocality, addressCountry, postalCode, telephone, email, website, logoUrl
  - `sameAs`: textarea where each line is one URL, split/join on newlines when reading/writing
  - Client-side validation: URL format for `website`, `logoUrl`, and each `sameAs` entry; phone format for `telephone`
  - Loading state on save button; toast on success/error
  - Wrap in `<AdminLayout>` with page title "Business Info"

- [ ] **2.2** Add route in `src/App.tsx`:
  - Import `AdminBusinessInfo` lazily (same pattern as other admin pages)
  - Add `<Route path="/admin/business-info" element={<AdminBusinessInfo />} />` inside the `<RoleProtectedRoute allowedRole="admin">` block

- [ ] **2.3** Add navigation item in `src/components/admin/AdminLayout.tsx` `SIDEBAR_ITEMS`:
  - `{ label: "Business Info", icon: Building2, path: "/admin/business-info" }`
  - Add `Building2` to the lucide-react import at the top of the file
  - Place it logically near the "System" entry

- [ ] **2.4** Add `SettingsCard` in `src/pages/admin/AdminSettings.tsx`:
  - Icon: `Building2` (import from lucide-react)
  - Title: "Business Info"
  - Description: "Organization details used for SEO structured data (JSON-LD)"
  - `href`: `/admin/business-info`

---

### Phase 3: Frontend Integration (SEO)

- [ ] **3.1** Run `npx convex dev` (or `bunx convex dev`) to regenerate `convex/_generated/api.d.ts` after adding the new query/mutation. The `getBusinessInfo` query will then be accessible via `api.admin.getBusinessInfo`.

- [ ] **3.2** No changes needed to `src/lib/seo.ts` — instead, update `Layout.tsx` directly (see 3.3).

- [ ] **3.3** Update `src/components/Layout.tsx`:
  - Add `useQuery(api.admin.getBusinessInfo)` (public query, safe to call from Layout)
  - Replace the hardcoded `ORGANIZATION_SCHEMA` object with a dynamically built one using the query result
  - Fall back to the existing hardcoded values when fields are `null` (graceful degradation — do not omit the JSON-LD block entirely if data is missing)
  - Only render the `<script type="application/ld+json">` tag when at least `businessName` is set

---

### Phase 4: Testing & Verification

- [ ] **4.1** Add tests to `convex/admin/settings.test.ts` for `getBusinessInfo` and `updateBusinessInfo`:
  - Test: returns all nulls when no business keys are set
  - Test: `updateBusinessInfo` saves and retrieves all fields correctly
  - Test: `sameAs` round-trips correctly through JSON serialization
  - Test: `updateBusinessInfo` throws when called by a non-admin user
  - Test: `logAudit` is called with correct arguments on success

- [ ] **4.2** Create `src/pages/admin/AdminBusinessInfo.test.tsx`:
  - Test: renders all form fields
  - Test: pre-populates fields from `getBusinessInfo` query result
  - Test: save button calls `updateBusinessInfo` with correct payload
  - Test: `sameAs` textarea splits/joins correctly
  - Test: shows loading state while mutation is in flight
  - Test: shows success toast on save; error toast on failure

- [ ] **4.3** Run `bun run lint` — fix any issues before committing

- [ ] **4.4** Run `bun run type-check` — ensure no TypeScript errors

- [ ] **4.5** Run `bun run build` — confirm production build passes

---

## Related Issues

- #216: Admin page to manage organisation business details for SEO structured data (closely related — same feature)

## Notes

- The barrel file is `convex/admin.ts`, not `convex/admin/index.ts` — update exports there
- Admin page components live in `src/pages/admin/`, not `src/components/admin/`
- `getBusinessInfo` must be a **public** query (not `internalQuery`) so `Layout.tsx` can call it for all visitors
- `sameAs` JSON serialization: serialize with `JSON.stringify` on write, `JSON.parse` on read, guarded with try/catch and fallback to `[]`
- The `requireAdmin` helper is already imported in `convex/admin/settings.ts` — reuse it directly
