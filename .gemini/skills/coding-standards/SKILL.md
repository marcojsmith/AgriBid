---
name: coding-standards
description: Enforces AgriBid's coding standards, TypeScript rules, and JSDoc requirements. Use this for all code changes, bug fixes, and feature implementations.
---

# AgriBid Coding Standards

## 1. Type Safety (TypeScript)
- **NO `any`:** Strict prohibition of the `any` type. Use specific interfaces, types, or `unknown` if necessary.
- **Explicit Types:** Define interfaces for all function parameters, return values, and component props.
- **Type Guards:** Use type guards and assertions to ensure safety and prevent runtime errors.
- **No Suppression:** Never use `eslint-disable` or `@ts-ignore` to bypass type checking or linting. Refactor code to comply with standards and remove any legacy/stale directives encountered.

## 2. Documentation (JSDoc)
- **Mandatory for Exports:** Every exported function, component, class, and method MUST have a JSDoc block.
- **Required Tags:**
    - `@param`: For every argument (with type and description).
    - `@returns`: For all return values (even if `void` or `Promise<void>`).
    - `@example`: Provide at least one usage example for components and complex utilities.
    - `@throws`: Document potential errors for backend functions or utilities.
- **Cleanliness:** Remove unused or redundant `eslint-disable` and `@ts-ignore` directives.

## 3. Naming Conventions
- **Folders:** `hyphen-case` (e.g., `user-profile`).
- **React Components:** `PascalCase` (e.g., `UserProfile.tsx`).
- **Utilities/Modules:** `camelCase` or `kebab-case` (e.g., `queries.ts`, `auth-config.ts`).
- **Variables/Functions:** `camelCase` (e.g., `getUserProfile`).

## 4. Code Style & Best Practices
- **Modularity:** Keep files small (<300 lines). Break complex functions into smaller pieces.
- **Reuse:** Leverage `@/lib/` utilities and existing components before creating new ones.
- **Separation of Concerns:** Maintain strict boundaries between UI, business logic, and data access layers.
- **Imports:**
    - Use relative imports for local files.
    - Use absolute `@/` imports for shared modules.
    - Group imports logically: Built-in > External > Internal.
- **Export Pattern:** Prefer `export function Name()` over `export const Name = () =>`.
