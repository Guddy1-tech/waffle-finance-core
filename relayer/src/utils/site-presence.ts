/**
 * Tracks frontend "someone is on the site" pings so background pollers
 * can stay in deep sleep when the app has zero visitors and zero orders.
 */

let lastVisitorAt = 0;
let visitorTtlMs = 5 * 60_000;

export function configureSitePresence(ttlMs: number): void {
  visitorTtlMs = ttlMs;
}

/** Called by GET/POST /api/wake when the frontend loads or refreshes presence. */
export function markVisitorPresent(): boolean {
  lastVisitorAt = Date.now();
  return true;
}

export function hasRecentVisitor(): boolean {
  return lastVisitorAt > 0 && Date.now() - lastVisitorAt < visitorTtlMs;
}
