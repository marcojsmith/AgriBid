# Specification: Equipment Metadata Management

## Overview
Admins need the ability to manage equipment metadata (makes, models, categories) to maintain the integrity of the equipment catalog used in the listing wizard. This track implements a dedicated management interface on the admin dashboard, backend queries/mutations in Convex, and necessary schema updates.

## Functional Requirements
- **Backend (Convex):**
    - `getAllEquipmentMetadata()`: List all makes with their models and categories.
    - `getCategories()`: List all equipment categories.
    - `addEquipmentMake(make, models[], categoryId)`: Create a new make with initial models and link to a category.
    - `updateEquipmentMake(id, make, models[], categoryId)`: Update make name, models, and category association.
    - `deleteEquipmentMake(id)`: Soft delete a make and its models using an `isActive` flag.
    - `addModelToMake(makeId, model)`: Add a model to an existing make.
    - `removeModelFromMake(makeId, model)`: Soft delete a model from a make.
    - CRUD for Categories: `addCategory`, `updateCategory`, `deleteCategory` (soft delete).
- **Frontend (React/Admin):**
    - New "Equipment Catalog" tab/section in `AdminEquipmentCatalog.tsx`.
    - `EquipmentMetadataEditor.tsx`: Accordion-style list of makes with inline model editing and category badges.
    - Search/filter functionality for makes and categories.
    - Validation:
        - Unique make names across the platform.
        - Unique model names within a single make.
        - A new make must include at least one initial model.
- **Integration:**
    - The listing wizard should fetch and use this metadata for dropdowns.

## Non-Functional Requirements
- **Performance:** Efficient querying of metadata even as the list grows (100+ makes).
- **UX:** Clear feedback for CRUD operations; confirmation dialogs for deletion.
- **Data Integrity:** Soft deletes to preserve history for existing listings.

## Acceptance Criteria
- Admin can create a new category and it appears in the category list.
- Admin can create a new make, assign it to a category, and add multiple models.
- Duplicate makes are blocked with a validation error.
- Duplicate models within the same make are blocked.
- Admin can edit existing makes and categories.
- Admin can "delete" a make or model (marks as inactive), and it no longer appears in the listing wizard.
- The listing wizard dropdowns correctly show active makes, models, and categories.

## Out of Scope
- Bulk import (CSV/JSON).
- Advanced analytics for metadata usage.
