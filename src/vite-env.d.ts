/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom" />

/**
 * Vite environment variables container.
 * These properties are readonly and intended for build-time injection.
 */
interface ImportMetaEnv {
  /** Application version injected at build time from package.json. */
  readonly VITE_APP_VERSION: string;
  /** Convex deployment URL for client-server communication. */
  readonly VITE_CONVEX_URL: string;
  /** Convex site URL for production deployments. */
  readonly VITE_CONVEX_SITE_URL: string;
}

/**
 * Vite import meta object containing environment variables.
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
