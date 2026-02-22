type Breadcrumb = {
  timestamp: number;
  type: string;
  description: string;
  metadata?: string;
};

class ActivityTracker {
  private buffer: Breadcrumb[] = [];
  private capacity = 20;

  trackAction(type: string, description: string, metadata?: Record<string, unknown>) {
    const breadcrumb: Breadcrumb = {
      timestamp: Date.now(),
      type,
      description: sanitizeString(description),
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    };

    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push(breadcrumb);
  }

  getBreadcrumbs(): Breadcrumb[] {
    return this.buffer.slice();
  }

  initRouterIntegration() {
    // Basic integration: track history navigation events
    const origPush = history.pushState;
    const origReplace = history.replaceState;

    const trackLocation = () => {
      this.trackAction("navigation", `navigate to ${location.pathname}${location.search}`, { url: location.href });
    };

    // Monkey patch pushState/replaceState to capture SPA navigations
    const historyPrototype = history as unknown as {
      pushState: typeof history.pushState;
      replaceState: typeof history.replaceState;
    };
    historyPrototype.pushState = function (data: unknown, unused: string, url?: string | URL | null) {
      origPush.call(this, data, unused, url);
      trackLocation();
    };
    historyPrototype.replaceState = function (data: unknown, unused: string, url?: string | URL | null) {
      origReplace.call(this, data, unused, url);
      trackLocation();
    };

    window.addEventListener("popstate", trackLocation);
  }
}

function sanitizeString(s: string) {
  // Remove form-like values that look like emails, phones, or IDs
  return s
    .replace(/\b[\w.+-]+@[\w-]+\.[\w-.]+\b/g, "[redacted]")
    .replace(/\b\+?\d[\d\s()-]{6,}\b/g, "[redacted]")
    .replace(/\b[A-Z0-9_-]{6,}\b/g, "[redacted]");
}

const tracker = new ActivityTracker();
export const trackAction = tracker.trackAction.bind(tracker);
export const getBreadcrumbs = tracker.getBreadcrumbs.bind(tracker);
export default tracker;
