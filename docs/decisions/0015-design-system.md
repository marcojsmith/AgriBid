# 0015 - One design system: tokens, `ds` components and a dev-only reference page

Date: 2026-11 | Status: Accepted

## Context

Colours, type and status styling were defined per screen, and `theme.md` documented hex values that did not match `index.css`. The redesign of Home, Auction event and Lot detail (track `improve-screen-mockups`) needs the same status badge, price, countdown and photo treatment on every screen, and the rest of the app will be migrated afterwards.

## Decision

- Tokens live only in `src/index.css` (HSL, light and dark, exposed through `@theme`). WCAG AA is asserted per pair in `src/lib/theme-tokens.test.ts`.
- Domain components live in `src/components/ds/`, one PascalCase file each, on top of the shadcn primitives in `src/components/ui/`. Status derivation reuses `src/lib/auction-badges.ts` (`deriveDisplayStatus`); money and dates go through `formatRand` and `formatSastDate`.
- `CountdownTimer` stays as a thin wrapper over `ds/Countdown` so existing callers keep working. This changes their look slightly (no monospace, no pulse, amber and red thresholds).
- `docs/architecture/ui-design/design-system.md` is the single reference; `theme.md` is a pointer.
- A `/design-system` route renders every token and component. It is registered only when `import.meta.env.DEV` is true and loaded lazily, so Vite removes it from production bundles (verified by searching `dist`).
- SAST is a fixed UTC+2 offset (no daylight saving), so `formatSastDate` is deterministic without `Intl`.

## Consequences

- One place to change a colour or a status; screens stop hand-rolling badges.
- Contrast regressions fail the test suite.
- The reference page is not available on preview or production deployments; review it locally.
- Existing screens keep their old markup until the rollout track migrates them.
