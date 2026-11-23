/**
 * Whether the browser is an iPhone or iPad Safari tab that is not yet running
 * as an installed Home Screen app. iOS only allows web push for a site added
 * to the Home Screen, so these visitors get the "Add to Home Screen" guide
 * before the notification prompt (decision 2026-11-22, option A).
 *
 * @param env - What the browser reports
 * @param env.userAgent - `navigator.userAgent`
 * @param env.maxTouchPoints - `navigator.maxTouchPoints` (iPadOS reports a Mac user agent)
 * @param env.standalone - `navigator.standalone` or the `display-mode: standalone` match
 * @returns True when the guide should be shown
 */
export function needsHomeScreenInstall(env: {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
}): boolean {
  const iosDevice =
    /iPhone|iPad|iPod/.test(env.userAgent) ||
    (env.userAgent.includes("Macintosh") && env.maxTouchPoints > 1);
  return iosDevice && !env.standalone;
}

/**
 * Reads the current browser into {@link needsHomeScreenInstall}.
 *
 * @returns True when the visitor is on iOS Safari outside the installed app
 */
export function browserNeedsHomeScreenInstall(): boolean {
  if (typeof navigator === "undefined") return false;
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches);
  return needsHomeScreenInstall({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone,
  });
}
