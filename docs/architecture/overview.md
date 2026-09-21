# Architecture Overview

AgriBid is a real-time auction platform for agricultural machinery. This is the single reference for the tech stack and repository layout; deeper topics live in the sub-docs linked at the bottom.

## Stack

| Layer           | Technology                                          | Version (package.json)   |
| --------------- | --------------------------------------------------- | ------------------------ |
| Frontend        | React + Vite + TypeScript                           | 19.3 / 8.2 / 5.9         |
| Routing         | React Router                                        | 7.13                     |
| Styling / UI    | Tailwind CSS (via `@tailwindcss/vite`), shadcn/ui   | 4.x, Radix primitives    |
| Backend / DB    | Convex (reactive queries, cron, file storage)       | 1.45                     |
| Authentication  | Clerk (email/password + Google), JWT read by Convex | `@clerk/clerk-react` 5.x |
| Testing         | Vitest, Testing Library, `convex-test`              | 5.0 / 16 / 0.0.41        |
| Lint / format   | ESLint 9, Prettier 3, Husky + lint-staged           |                          |
| Type-check      | `tsgo` (`@typescript/native-preview`)               |                          |
| Package manager | Bun                                                 | 1.3.9                    |
| Deployment      | Vercel (`bunx convex deploy --cmd 'bun run build'`) |                          |

`@convex-dev/aggregate` is a dependency but no component is registered in `convex/convex.config.ts` yet.

## Repository map

```text
convex/                 Backend
  schema.ts             All tables and indexes
  auth.config.ts        Clerk JWT issuer (CLERK_JWT_ISSUER_DOMAIN)
  auctions/             Bidding, proxy bidding, settlement (internal.ts), queries/, mutations/
  admin/                KYC, categories, equipment metadata, fees, settings, stats, moderation
  lots/                 Lot mutations
  lib/                  auth (role checks), encryption (AES-256-GCM), storage helpers
  crons.ts              Scheduled jobs (see below)
  http.ts               HTTP routes
  users, messages, notifications, watchlist, reviews, support, presence,
  errors, faq, seed ... one module per domain (public + internal functions)
src/                    Frontend
  main.tsx              ClerkProvider > ConvexProviderWithClerk > app
  App.tsx               Routes
  pages/                Route-level views (admin/, dashboard/, kyc/ subfolders)
  components/           Feature components (admin, auction, bidding, header, kyc,
                        listing-wizard) and ui/ (shadcn)
  contexts/             User profile, admin stats, branding providers
  hooks/                Custom hooks (admin/, kyc/, listing-wizard/)
  lib/                  Shared utilities (auction-utils, currency, seo, error reporting)
  types/                Shared TypeScript types
  test/                 Test setup
docs/                   STATUS, CHANGELOG, LESSONS, decisions/, architecture/, product/
conductor/              Plans for work in flight: tracks/ (spec.md + plan.md), archive/
scripts/, public/       Tooling and static assets
```

Build config: `vite.config.ts` (alias `@` -> `src`, `convex/_generated` alias, optional Tailscale HTTPS certs from `certs/`), `vitest.config.ts`, `tsconfig.*.json`, `vercel.json`.

## Request flow

1. **Client**: React components call Convex hooks (`useQuery`, `useMutation`, `useAction`). Queries are reactive over WebSocket, so bids, prices and status changes push to every subscriber with no polling.
2. **Auth**: `ClerkProvider` issues a JWT; `ConvexProviderWithClerk` attaches it to the Convex connection. Convex validates it against the issuer in `convex/auth.config.ts`. Server functions resolve the caller and role through `convex/lib/auth.ts`; the client never decides authorization.
3. **Functions**: public `query`/`mutation`/`action` in `convex/*.ts` validate args and returns, check role, then read or write tables through indexes. Mutations are ACID transactions, so a bid, the price update and any soft-close extension commit atomically.
4. **Scheduled work** (`convex/crons.ts`): settle expired auctions (every minute), delete abandoned drafts (daily), clean presence records (15 min), process error reports into GitHub issues (daily), reset the showcase mock data (weekly).
5. **File storage**: images and KYC documents upload to Convex File Storage via upload URLs; storage ids are kept on the documents. Sensitive KYC fields are encrypted at rest.

## Key conventions

- Roles: guest, buyer, seller, admin. Enforce on the server.
- Convex rules: new function syntax, argument and return validators on every function, indexes over `.filter()`, internal functions for private logic. See `.claude/rules/convex_rules.md`.
- TypeScript strict; no `any`. Folders `hyphen-case`, components `PascalCase`, utils/hooks `camelCase`. Full standards in `AGENTS.md`.
- Tests are colocated (`*.test.ts(x)`) and run with `bun run test`; gate with `bun run lint` and `bun run type-check`.
- Live work state: [`../STATUS.md`](../STATUS.md).

## Sub-docs

- [Data flow](./data-flow/): auth, bidding and listing sequences
- [Database](./database/): ERDs and table relationships (source of truth: `convex/schema.ts`)
- [Security](./security/): encryption and RBAC policies
- [UI design](./ui-design/): design system and layouts
- Product: [vision](../product/vision.md), [roadmap](../product/roadmap.md)
