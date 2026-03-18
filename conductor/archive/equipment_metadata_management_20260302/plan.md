# Implementation Plan: Equipment Metadata Management

## Phase 1: Schema and Seed Data

- [x] Task: Update `app/convex/schema.ts` to include `equipmentCategories` table and enhance `equipmentMetadata`. (33ab558)
- [x] Task: Update `app/convex/seed.ts` to migrate existing data and pre-populate categories. (33ab558)
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Schema and Seed Data' (Protocol in workflow.md)

## Phase 2: Backend Development (TDD)

- [x] Task: Create backend tests for metadata and category management. (e2295da)
  - [x] Create `app/convex/admin/equipmentMetadata.test.ts` and `app/convex/admin/categories.test.ts`.
- [x] Task: Implement Category CRUD mutations and queries. (33ab558)
  - [x] Create `app/convex/admin/categories.ts`.
  - [x] Implement `getCategories`, `addCategory`, `updateCategory`, `deleteCategory` (soft delete).
- [x] Task: Implement Equipment Metadata CRUD mutations and queries. (33ab558)
  - [x] Create `app/convex/admin/equipmentMetadata.ts`.
  - [x] Implement `getAllEquipmentMetadata`, `addEquipmentMake`, `updateEquipmentMake`, `deleteEquipmentMake`, `addModelToMake`, `removeModelFromMake`.
- [x] Task: Verify all backend tests pass and coverage is >80%. (2509280)
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Backend Development' (Protocol in workflow.md) (2509280)
  - _Note: Manual verification deferred to the end per user request._

## Phase 3: Frontend Development (Admin UI)

- [x] Task: Implement `EquipmentMetadataEditor.tsx` component. (2509280)
- [x] Task: Update `AdminSettings.tsx` to include the "Equipment Catalog" tab. (2509280)
- [x] Task: Implement Category Management UI. (2509280)
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Frontend Development' (Protocol in workflow.md) (2509280)
  - _Note: Manual verification deferred to the end per user request._

## Phase 4: Integration and Quality Assurance

- [x] Task: Update Listing Wizard to use dynamic metadata. (3b7e843)
  - [x] Ensure dropdowns fetch active categories, makes, and models.
- [ ] Task: End-to-end verification using Chrome DevTools MCP.
- [x] Task: Final code review and version bump in `app/package.json`. (49d8b92)
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Integration and Quality Assurance' (Protocol in workflow.md)
  - _Note: Manual verification deferred to the end per user request._
