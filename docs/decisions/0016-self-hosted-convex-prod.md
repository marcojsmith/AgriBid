# 0016 - Production backend on self-hosted Convex

Date: 2026-11-21 | Status: Accepted

## Context

Production (Vercel project `agribid`, served at `https://agribid-iota.vercel.app`) ran on the Convex Cloud Free-plan deployment `tangible-marmot-95`. On 2026-10-20 Convex disabled the deployment because the 1-minute settlement cron exceeded the Free-plan limits, and the showcase stopped refreshing. A self-hosted Convex backend already ran in Docker on the owner's machine for demos (`agribid-local`). Production holds only showcase data, rebuilt weekly by `seed:weeklyReset` (0009).

## Decision

Serve production from the self-hosted backend.

- Backend: docker compose project `agribid-local` (`C:\Users\marco\docker\agribid-local`), with the API on `127.0.0.1:3230` and HTTP actions on `127.0.0.1:3231`. Data lives in the volume `agribid-local_convex-data`.
- Public HTTPS: nginx (the NSSM Windows service `nginx`) with `ssl-agribid.conf`:
  - `https://agribid-convex.duckdns.org` (443) proxies the API and websocket.
  - `:8443` proxies HTTP actions.
  - Both ports are shared with other vhosts via SNI.
  - A win-acme Let's Encrypt cert renews automatically, and a scheduled DuckDNS updater keeps the IP current.
- Vercel production env:
  - `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` replace `CONVEX_DEPLOY_KEY`.
  - `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` point at the URLs above.
  - The prod build (`bunx convex deploy --cmd 'bun run build'`) therefore pushes functions to the self-hosted backend.
- Backend env: copied from Cloud prod (same `PII_ENCRYPTION_KEY`, so encrypted PII stays readable, and same Clerk issuer). `ALLOWED_ORIGINS` lists the production aliases.
- Cloud prod data was exported and imported with `--replace-all`. The Cloud deployment is left untouched as the rollback target.

## Consequences

- No plan limits on crons or bandwidth, and no hosting cost.
- Availability depends on one home PC, its power and its connection. There is no SLA or redundancy.
- No automatic backups. Use `bunx convex export --include-file-storage` (backups go in `agribid-local/backups/`).
- Operating it needs local admin rights. nginx config changes need `Restart-Service nginx` (elevated), because `nginx -s reload` is denied for a LocalSystem service.
- The self-hosted admin key is effectively a production root credential. It lives only in `agribid-local/.admin-key` and as a Vercel sensitive env var.
- Vercel build logs show the self-hosted target as `[REDACTED]` because the URL is stored as a sensitive var. Confirm deploys in the backend log (`deploy2/finish_push`).
- Rollback steps: `docs/architecture/overview.md` (Deployment).
