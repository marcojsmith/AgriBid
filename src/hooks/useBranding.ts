import { createTypedContext } from "@/contexts/createTypedContext";

/**
 * Branding values exposed to all UI components through React context.
 *
 * @property appName - The application's business name (e.g. "AgriBid")
 */
export interface Branding {
  appName: string;
}

export const [BrandingContext, useBranding] =
  createTypedContext<Branding>("Branding");
