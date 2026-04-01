/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom" />

declare module "virtual:pwa-register/react" {
  import type { Dispatch, SetStateAction } from "react";

  interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (
      registration: ServiceWorkerRegistration | undefined
    ) => void;
    onRegisterError?: (error: Error) => void;
  }

  interface UseRegisterSWReturn {
    needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
    offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  }

  export function useRegisterSW(
    options?: RegisterSWOptions
  ): UseRegisterSWReturn;
}

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
  /** VAPID public key for web push notifications. */
  readonly VITE_VAPID_PUBLIC_KEY: string;
}

/**
 * Vite import meta object containing environment variables.
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
