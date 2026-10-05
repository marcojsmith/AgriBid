import type { FunctionReturnType } from "convex/server";
import type { api } from "convex/_generated/api";

import { createTypedContext } from "@/contexts/createTypedContext";

/**
 * Business details configured by an admin, as returned by `admin.getBusinessInfo`.
 */
export type BusinessInfo = FunctionReturnType<typeof api.admin.getBusinessInfo>;

/**
 * Branding values exposed to all UI components through React context.
 *
 * @property appName - The application's business name (e.g. "AgriBid")
 * @property businessInfo - The configured business details, or `undefined`
 *   while `admin.getBusinessInfo` is still loading
 */
export interface Branding {
  appName: string;
  businessInfo: BusinessInfo | undefined;
}

export const [BrandingContext, useBranding] =
  createTypedContext<Branding>("Branding");
