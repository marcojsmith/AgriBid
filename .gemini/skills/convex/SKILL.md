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
- **Root Directory**: `app/` (or the directory containing your frontend and `convex/` folder)
- **Build Command**: `npx convex deploy --cmd 'npm run build'` (Override: **ON**)
- **Install Command**: `npm install` (or your preferred manager)
- **Output Directory**: `dist`

### Required Build Script Changes
In `app/package.json`, ensure the `build` script includes `codegen` to generate types before TypeScript compilation:

```json
{
  "scripts": {
    "build": "npx convex codegen && tsc -b && vite build"
  }
}
```

## TypeScript & Path Resolution

Convex generated files should be gitignored, which requires specific configuration to resolve types during build and development.

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

- **Backend Sync**: Always use `npx convex deploy` in the CI/CD build command rather than a separate step to ensure the frontend is built against the correct backend version.
- **Gitignore**: Always ignore `convex/_generated/`. Do not commit these files.
- **Auth Proxying**: If using Better Auth or similar, ensure the Vite proxy is configured to point to your Convex Site URL during local development.
