# React Coding Styleguide & Modularization Patterns

## Component Size Guidelines

To maintain readability and testability, we follow these size guidelines:

- **Target Size:** < 200 lines of code.
- **Readability Trigger:** 250-300 lines. When a component exceeds this range, it MUST be evaluated for decomposition.
- **Complexity Trigger:** If a component mixes more than two major concerns (e.g., data fetching, form state, complex UI orchestration, multiple dialogs), it should be split.

## Modularization Pattern

### 1. Feature Directory Structure
For complex features (e.g., `AdminDashboard`, `KYC`, `ListingWizard`), use a dedicated directory structure:

```
src/pages/feature-name/
├── context/             # React Context and Provider
├── hooks/               # Feature-specific custom hooks
├── sections/            # Major visual sections or Tabs
├── components/          # Small, feature-specific components
├── utils.ts             # Feature-specific utility functions
├── types.ts             # Feature-specific TypeScript interfaces
└── FeatureNameContent.tsx # Main UI orchestrator
```

**When to use full structure:**
- Features with 3+ major UI sections or tabs.
- Multi-step flows (e.g., `ListingWizard`, `KYC`).
- Features requiring a dedicated Context Provider to manage shared state.
- **Simpler Alternative:** For small features, use a single file or a flat folder containing `{Component.tsx, utils.ts, types.ts}`.

### 2. State Management
- **Local State:** Use `useState` for simple, component-specific state.
- **Shared Feature State:** Use a **React Context Provider** for state shared across multiple sections or tabs within a single feature.
- **Business Logic:** Extract complex logic, validations, and async operations into **Custom Hooks**.
- **Global State:** Opt for external libraries (e.g., **Zustand**, **Redux**) only when state must be shared across many unrelated features, or when performance issues arise from Context re-renders.

### 3. Component Extraction
- Extract repetitive UI elements into small, reusable components in `src/components/feature-name/` or `src/components/ui/` if generic.
- Extract major visual blocks (e.g., Tabs, Form Sections) into `sections/`.
- Extract large dialogs and modals into a separate `Dialogs.tsx` or individual component files.

## Directory Organization

- `src/components/`: Reusable UI components.
- `src/hooks/`: Cross-feature utility hooks (e.g., `useFileUpload`, `useDebounce`).
- `src/pages/`: Page-level components and feature-specific modularized structures.
- `src/lib/`: Global utility functions and service clients.

## Canonical Examples
- **AdminDashboard Refactor:** `app/src/pages/admin/` - Demonstrates Context-based state sharing and Tab extraction.
- **ListingWizard Refactor:** `app/src/components/ListingWizard/` - Demonstrates step-based modularization and form logic extraction.
- **KYC Refactor:** `app/src/pages/kyc/` - Demonstrates hook-based logic extraction and section splitting.
- **Bidding Refactor:** `app/src/components/bidding/` - Demonstrates component grouping and shared logic.
