# Specification: Refactor Auction Mutations

## Overview

The `convex/auctions/mutations.ts` file has grown significantly (~1,182 lines, ~25 distinct mutations), which exceeds maintainability best practices. This track aims to refactor the file by splitting it into smaller, logically grouped files based on functionality (create, update, delete, publish, bidding). Additionally, the associated test file (`mutations.test.ts`) will be split accordingly.

## Scope

- Break down `convex/auctions/mutations.ts` into multiple files within a new `convex/auctions/mutations/` directory.
- Break down `convex/auctions/mutations.test.ts` to mirror the new file structure.
- Update all imports across the codebase to point to the specific new mutation files, bypassing any barrel files.

## Functional Requirements

N/A - This is a pure refactor. No new functionality will be added, and existing functionality must remain unchanged.

## Non-Functional Requirements

- **Maintainability**: New files should ideally not exceed 300 lines.
- **Code Quality**: No type errors (`bun run build` must pass) and no linting issues (`bun run lint` must pass). All existing tests must continue to pass.

## Implementation Details

### Target File Structure

```text
convex/auctions/
├── mutations/
│   ├── create.ts         # Auction creation mutations
│   ├── create.test.ts
│   ├── update.ts         # Update mutations
│   ├── update.test.ts
│   ├── delete.ts         # Delete/cancel mutations
│   ├── delete.test.ts
│   ├── publish.ts        # Status/publish mutations
│   ├── publish.test.ts
│   ├── bidding.ts        # Bid-related mutations
│   └── bidding.test.ts
```

## Acceptance Criteria

- [ ] `convex/auctions/mutations.ts` and `mutations.test.ts` are removed and their contents successfully split into the `mutations/` directory.
- [ ] All codebase imports are updated to reference the specific new module files (e.g., `import ... from "convex/auctions/mutations/create"`).
- [ ] `bun run build` completes with zero errors.
- [ ] `bun run lint` completes with zero errors.
- [ ] `bun run test --run` passes all tests.

## Out of Scope

- Adding new mutations or removing existing ones.
- Refactoring the internal logic of individual mutations beyond what is required to support the file split and manage imports.
