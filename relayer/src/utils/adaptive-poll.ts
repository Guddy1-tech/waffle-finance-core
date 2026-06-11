/**
 * Poll loop with two speeds:
 * - **Attentive** (visitor on site or order in flight): re-check every `activeIntervalMs`
 * - **Deep idle** (no visitors, no orders): re-check every `idleIntervalMs`
 *
 * `tick()` (RPC) runs only when `isActive()` is true. Attentive mode does
 * not hit the chain — it just keeps the loop ready so a new order is picked
 * up within one active window.
 */

export interface AdaptivePollOptions {
  label: string;
  /** Re-check cadence while attentive or while `isActive()`. */
  activeIntervalMs: number;
  /** Re-check cadence when nobody is on the site and `isActive()` is false. */
  idleIntervalMs?: number;
  /** When true, `tick()` may run (usually: open bridge orders exist). */
  isActive: () => boolean;
  /**
   * When true, use `activeIntervalMs` even if `isActive()` is false.
   * Typically wired to `hasRecentVisitor()`.
   */
  isAttentive?: () => boolean;
  tick: () => Promise<void>;
}

export interface AdaptivePollHandle {
  stop(): void;
  /** Run a check immediately (e.g. visitor ping or new order). */
  wake(): void;
}

export function startAdaptivePoll(options: AdaptivePollOptions): AdaptivePollHandle {
  const {
    label,
    activeIntervalMs,
    idleIntervalMs = 120_000,
    isActive,
    isAttentive = () => false,
    tick,
  } = options;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const schedule = (delayMs: number) => {
    if (stopped) return;
    timer = setTimeout(() => { void run(); }, delayMs);
  };

  const run = async () => {
    if (stopped || running) return;
    running = true;
    const active = isActive();
    const attentive = isAttentive();
    try {
      if (active) {
        await tick();
      }
    } catch (err: any) {
      console.warn(`[${label}] poll tick failed:`, err?.shortMessage ?? err?.message ?? err);
    } finally {
      running = false;
      schedule(active || attentive ? activeIntervalMs : idleIntervalMs);
    }
  };

  schedule(0);
  console.log(
    `[${label}] adaptive poll — attentive ${activeIntervalMs / 1000}s / deep idle ${idleIntervalMs / 1000}s, RPC only when active`
  );

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
    wake() {
      if (stopped || running) return;
      if (timer) clearTimeout(timer);
      schedule(0);
    },
  };
}
