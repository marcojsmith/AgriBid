import type { ReactNode } from "react";
import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

import { BrandingContext } from "@/hooks/useBranding";
import { SITE_NAME } from "@/lib/seo";

/**
 * Supply the application's branding values to descendant components.
 *
 * Fetches business info from the backend once and shares it through context,
 * so descendants read the app name and business details without subscribing to
 * `admin.getBusinessInfo` themselves. `appName` is derived from the configured
 * business name, falling back to `SITE_NAME` ("AgriBid") while loading or when
 * the value is unavailable.
 *
 * @param props - Component props
 * @param props.children - React nodes to render inside the provider
 * @returns A React element wrapping children in BrandingContext.Provider
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const businessInfo = useQuery(api.admin.getBusinessInfo);

  // During loading (undefined) or when the value is null/empty, fall back to
  // the static SITE_NAME so children never receive undefined.
  const rawName = businessInfo?.businessName;
  const appName =
    typeof rawName === "string" && rawName.trim() !== ""
      ? rawName.trim()
      : SITE_NAME;

  const value = useMemo(
    () => ({ appName, businessInfo }),
    [appName, businessInfo]
  );

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}
