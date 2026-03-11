---
name: ui-design
description: Expertise in AgriBid's UI/UX standards, design language, accessibility, and responsiveness. Use this when creating components, pages, or styling UI elements.
---

# AgriBid UI Design Standards

## 1. Visual Design & Theming

- **Consistency:** Maintain a consistent design language using the earth-tone palette and Shadcn/UI components.
- **Theming:** Use centralized theme variables for colors, fonts, and spacing. NEVER hardcode hex codes or pixel values in components.
- **Clarity:** Use clear labels, tooltips, and helper text to guide users.
- **Simplicity:** Avoid clutter and unnecessary elements.

## 2. Componentization

- **Composition:** Break UI into small, reusable components following React composition patterns.
- **Installation:** Prefer installing Shadcn/UI components (`bunx shadcn-ui@latest add <component>`) and customizing them rather than building from scratch.
- **Standard Patterns:**
  - **Full Page Loads:** Use `LoadingPage` component.
  - **Component Loads:** Use `LoadingIndicator` or a skeleton component.
  - **Action Feedback:** Use `isLoading` boolean + `disabled` prop for buttons.
  - **Messages:** Use `toast.error` or `toast.success` for user feedback.

## 3. Responsiveness (Mobile-First)

- **Mobile:** 375px width, 812px height (e.g., iPhone 14 Pro).
- **Tablet:** 768px width, 1024px height (e.g., iPad).
- **Desktop:** 1440px width, 900px height (e.g., MacBook Pro).
- Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`) to ensure layout integrity across all screens.

## 4. Accessibility (A11y)

- **Semantics:** Use proper HTML landmarks (`<header>`, `<main>`, `<nav>`, `<aside>`).
- **Roles:** Ensure correct ARIA roles and attributes for interactive elements.
- **Navigation:** All interactive elements must be keyboard-navigable.
- **Alt Text:** Every image must have a descriptive `alt` attribute.

## 5. UI Verification (MCP)

- Use **Chrome DevTools MCP** to verify UI changes before committing.
- **One Action at a Time:** Perform single interactions (click, fill) and wait for the snapshot response to maintain context.
- **Screenshots:** Take snapshots to verify layout and design consistency across different viewports.
