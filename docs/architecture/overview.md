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
| Deployment      | Vercel frontend + self-hosted Convex (see below)    |                          |

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

## Deployment

Decision record: ADR [0016](../decisions/0016-self-hosted-convex-prod.md).

- **Frontend:** Vercel project `agribid`. Production is `https://agribid-iota.vercel.app` (`agribid.vercel.app` belongs to someone else). On production, `vercel.json` runs `bunx convex deploy --cmd 'bun run build'`; previews only run `bun run build`.
- **Backend:** self-hosted Convex. It's the docker compose project `agribid-local` in `C:\Users\marco\docker\agribid-local` on the owner's PC. The runbook and admin key are local to that folder and never committed.
  - API and websocket: `https://agribid-convex.duckdns.org`, which nginx proxies to `127.0.0.1:3230`.
  - HTTP actions: `https://agribid-convex.duckdns.org:8443`, proxied to `127.0.0.1:3231`.
  - Dashboard: `http://localhost:6792`, local only.
- **Vercel production env:** `CONVEX_SELF_HOSTED_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY` (sensitive), `VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `VITE_CLERK_PUBLISHABLE_KEY`. The build log masks the deploy target as `[REDACTED]`; confirm a deploy with `docker logs agribid-local-backend-1 | grep finish_push`.
- **Backend env:** `CLERK_JWT_ISSUER_DOMAIN`, `PII_ENCRYPTION_KEY` (the same key Cloud prod used), `DOCUMENT_ENCRYPTION_KEY` (base64 of 32 random bytes; encrypts uploaded ID, passport and address files, `openssl rand -base64 32`; the backend fails closed without it), `ALLOWED_ORIGINS` (production aliases), `SEED_SECRET`, `BETTER_AUTH_SECRET` (legacy), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (sensitive) and `VAPID_SUBJECT` (`https://agribid-iota.vercel.app`) for Remind me web push (`bunx web-push generate-vapid-keys --json`; unset means no pushes are sent).
- **Ops:**
  - Run one-off functions from a checkout without `.env.local`, with `CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3230` and `CONVEX_SELF_HOSTED_ADMIN_KEY` set.
  - After changing nginx config, restart it with `Restart-Service nginx` from an elevated shell. `nginx -s reload` is denied because nginx runs as a LocalSystem service.
  - Back up with `bunx convex export --include-file-storage --path <zip>`.

### Rollback to Convex Cloud

The Cloud deployment `tangible-marmot-95` is left untouched.

1. Convex dashboard → `tangible-marmot-95` → Settings → generate a production deploy key. Re-enable the deployment if Convex has disabled it.
2. Vercel production env:
   - Add `CONVEX_DEPLOY_KEY`.
   - Remove `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`; the CLI refuses to run with both kinds set.
   - Set `VITE_CONVEX_URL=https://tangible-marmot-95.eu-west-1.convex.cloud`.
   - Remove `VITE_CONVEX_SITE_URL`.
3. Run `bunx vercel redeploy <latest production deployment URL> --target production`.
4. Optional: export the self-hosted data and `convex import --prod --replace-all` it into Cloud first, to keep writes made since the cutover.

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
