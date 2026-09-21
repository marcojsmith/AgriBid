# 0011 - Route-based admin portal

Date: undated | Status: Accepted

## Context

The admin dashboard was a monolithic, context-based design.

## Decision

Refactor into route-based pages under `/admin/*`, each with isolated local state. A shared `AdminLayout` provides sidebar navigation and a KPI header. Admin actions are audit-logged, and listings flow through a moderation queue (`pending_review`, then approve or reject). Flagging with auto-hide thresholds feeds the admin review dashboard.

## Consequences

- KPIs and moderation state are local to each route.
- N+1 admin queries are consolidated through batch helpers.
- Later multi-lot work split `/admin/lots` from `/admin/auctions` (see 0003).
