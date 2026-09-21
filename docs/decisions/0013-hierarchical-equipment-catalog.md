# 0013 - Hierarchical equipment catalog

Date: 2026-03 | Status: Accepted

## Context

Equipment category, make, and model were static strings.

## Decision

Use a dynamic `equipmentCategories` -> `equipmentMetadata` (make) -> `models` hierarchy, managed in `AdminEquipmentCatalog.tsx`. `ListingWizard` enforces hierarchical selection. Deletes are soft (`isActive`). `fixMetadata` mapped legacy data; `runSeed` carries a Southern African machinery catalog.

## Consequences

- Admins can CRUD categories, manufacturers, and models without code changes.
- The weekly reset leaves this catalog untouched (see 0009).
