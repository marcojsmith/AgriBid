/**
 * Activity tracker for capturing user action breadcrumbs.
 *
 * Maintains a ring buffer of the last 20 user actions to provide context
 * when reporting errors.
 */

type BreadcrumbType = "navigation" | "interaction" | "mutation" | "custom";

interface Breadcrumb {
  timestamp: number;
  type: BreadcrumbType;
  description: string;
  metadata?: Record<string, unknown>;
}

const MAX_BREADCRUMBS = 20;

let breadcrumbs: Breadcrumb[] = [];

/**
 * Track a user action for error reporting context.
 *
 * @param type - The type of action (navigation, interaction, mutation, custom)
 * @param description - A description of the action
 * @param metadata - Optional metadata about the action
 */
export function trackAction(
  type: BreadcrumbType,
  description: string,
  metadata?: Record<string, unknown>
): void {
  const breadcrumb: Breadcrumb = {
    timestamp: Date.now(),
    type,
    description,
    metadata,
  };

  breadcrumbs.push(breadcrumb);

  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs = breadcrumbs.slice(-MAX_BREADCRUMBS);
  }
}

/**
 * Get a copy of the current breadcrumbs.
 *
 * @returns Array of breadcrumbs (new array, not reference)
 */
export function getBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbs];
}

/**
 * Clear all breadcrumbs.
 * Useful for testing or when starting a new session.
 */
export function clearBreadcrumbs(): void {
  breadcrumbs = [];
}

/**
 * Track navigation actions (route changes).
 *
 * @param path - The navigation path or URL
 */
export function trackNavigation(path: string): void {
  trackAction("navigation", `Navigated to ${path}`);
}

/**
 * Track user interaction (clicks, form submissions).
 *
 * @param action - Description of the interaction
 * @param metadata - Optional metadata about the interaction
 */
export function trackInteraction(
  action: string,
  metadata?: Record<string, unknown>
): void {
  trackAction("interaction", action, metadata);
}

/**
 * Track mutation calls (Convex mutations).
 *
 * @param action - Description of the mutation
 * @param metadata - Optional metadata about the mutation
 */
export function trackMutation(
  action: string,
  metadata?: Record<string, unknown>
): void {
  trackAction("mutation", action, metadata);
}
