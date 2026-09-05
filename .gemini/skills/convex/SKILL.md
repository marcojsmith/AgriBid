---
name: convex
description: Expert guidance for working with Convex, including backend development, schema design, and integration with Vercel for automated deployments. Use when building Convex functions, configuring deployments, or resolving type-generation issues in CI/CD.
---

# Convex Development & Vercel Integration

Expert guidance for maintaining a Convex backend synchronized with a Vite frontend, particularly within a Vercel-based deployment pipeline.

## Vercel Deployment Configuration

To ensure successful automated deployments, follow these dashboard and codebase configurations.

### Dashboard Settings

- **Framework Preset**: `Vite`
- **Root Directory**: `app/`
- **Build Command**: `bunx convex deploy --cmd 'bun run build'` (Override: **ON**)
- **Output Directory**: `dist`

### Handling Preview Deployments (Dynamic URLs)

Vercel Previews create fresh Convex backends. To make them work with Clerk-based auth
(see `convex/auth.config.ts`):

1. **Convex Project Defaults**: In Convex Dashboard > Project Settings > Environment Variables, set `CLERK_JWT_ISSUER_DOMAIN` as a **Project Default** (pointing at Clerk's Development instance). This ensures fresh preview backends inherit it without a manual `convex env set` per preview.
2. **Frontend Publishable Key**: Set `VITE_CLERK_PUBLISHABLE_KEY` as a Vercel Preview environment variable, matching the same Clerk Development instance.
3. **Vite Config**: Use `VERCEL_URL` as a fallback for the frontend site URL to handle dynamic branch deployments.

```typescript
// app/vite.config.ts
const siteUrl =
  env.VITE_CONVEX_SITE_URL ||
  (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "http://localhost:5173");
```

### Required Build Script Changes

In `app/package.json`, ensure the `build` script includes `codegen` to generate types before TypeScript compilation:

```json
{
  "scripts": {
    "build": "bunx convex codegen && tsc -b && vite build"
  }
}
```

## TypeScript & Path Resolution

Convex-generated files should be gitignored, which requires specific configuration to resolve types during build and development.

### path Aliases (`tsconfig.json` & `vite.config.ts`)

Ensure the `convex/_generated` alias is defined:

**tsconfig.json**:

```json
{
  "compilerOptions": {
    "paths": {
      "convex/_generated/*": ["./convex/_generated/*"]
    }
  }
}
```

**vite.config.ts**:

```typescript
resolve: {
  alias: {
    'convex/_generated': path.resolve(__dirname, './convex/_generated'),
  },
}
```

### TypeScript Inclusion

The `convex/` directory MUST be included in your `include` array for `tsc` to find the generated types:

**tsconfig.app.json**:

```json
{
  "include": ["src", "convex"]
}
```

## Best Practices

- **Backend Sync**: Always use `bunx convex deploy` in the CI/CD build command rather than a separate step to ensure the frontend is built against the correct backend version.
- **Gitignore**: Always ignore `convex/_generated/`. Do not commit these files.
- **Auth**: This project uses Clerk (JWT verified natively by Convex via `convex/auth.config.ts`) — no auth HTTP routes or Vite proxy are needed for authentication.
