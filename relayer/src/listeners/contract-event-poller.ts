/**
 * Block-by-block event poller for ethers `Contract` instances.
 *
 * Public RPCs (PublicNode, Ankr, etc.) sit behind load balancers and
 * do NOT keep `eth_newFilter` state per node — the filter id created
 * on one upstream is unknown to the next, producing `filter not found`
 * errors and silently dropping events for any `contract.on(...)`
 * subscription.
 *
 * `queryFilter` is stateless on the RPC side (it's just `getLogs`),
 * which works reliably across load balancers. This helper drives a
 * single shared poll loop for any number of (eventName, handler) pairs
 * against one contract, so callers don't need to reinvent the cursor
 * + re-entrancy + chunking logic each time.
 */

import type { Contract, EventLog, JsonRpcProvider } from 'ethers';
import { startAdaptivePoll, type AdaptivePollHandle } from './adaptive-poll.js';

export interface ContractEventBinding {
  /** Event name as declared in the contract ABI (e.g. "OrderCreated"). */
  eventName: string;
  /**
   * Same calling convention as `contract.on` — the contract args
   * spread first, then the underlying `EventLog`.
   */
  handler: (...args: any[]) => void | Promise<void>;
}

export interface ContractEventPollerOptions {
  /** How often to ask the RPC for new blocks when orders are active. Defaults to 15s. */
  intervalMs?: number;
  /** Delay between ticks when idle (no active orders). Defaults to 120s. */
  idleIntervalMs?: number;
  /**
   * When provided and returns false, the tick is skipped (zero RPC) until the next re-check.
   * The loop still wakes on idleIntervalMs so monitoring resumes
   * automatically once orders appear.
   */
  isActive?: () => boolean;
  /** When true, re-check on activeIntervalMs even if `isActive()` is false. */
  isAttentive?: () => boolean;
  /**
   * Hard cap on a single `getLogs` window. Public RPCs reject huge
   * ranges; if we ever fall behind by more than this, we walk
   * forward one chunk per tick. Defaults to 500.
   */
  maxBlockWindow?: number;
  /**
   * Optional starting block. Defaults to "current head" so we don't
   * re-emit historical events on restart.
   */
  startBlock?: number;
  /** Tag used in log lines to disambiguate multiple pollers. */
  label?: string;
}

export interface ContractEventPollerHandle {
  stop(): void;
  wake(): void;
  /** Cursor block — last block we've scanned through (inclusive). */
  cursor(): number;
}

const DEFAULT_INTERVAL_MS = 15_000;
const DEFAULT_IDLE_INTERVAL_MS = 120_000;
const DEFAULT_MAX_WINDOW = 500;

export async function startContractEventPoller(
  contract: Contract,
  provider: JsonRpcProvider,
  bindings: ContractEventBinding[],
  options: ContractEventPollerOptions = {}
): Promise<ContractEventPollerHandle> {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const idleIntervalMs = options.idleIntervalMs ?? DEFAULT_IDLE_INTERVAL_MS;
  const maxWindow = options.maxBlockWindow ?? DEFAULT_MAX_WINDOW;
  const label = options.label ?? 'contract-poller';
  const isActive = options.isActive ?? (() => true);
  const isAttentive = options.isAttentive ?? (() => true);

  let lastProcessed = options.startBlock ?? (await provider.getBlockNumber());
  let isPolling = false;

  const tick = async () => {
    if (isPolling) return;
    isPolling = true;
    try {
      const head = await provider.getBlockNumber();
      if (head <= lastProcessed) return;

      const fromBlock = lastProcessed + 1;
      const toBlock = Math.min(head, fromBlock + maxWindow - 1);

      for (const binding of bindings) {
        const filterFactory = contract.filters[binding.eventName];
        if (typeof filterFactory !== 'function') {
          console.warn(`[${label}] no filter factory for event "${binding.eventName}"; skipping`);
          continue;
        }
        const filter = filterFactory();
        const events = await contract.queryFilter(filter, fromBlock, toBlock);
        for (const ev of events) {
          // queryFilter returns `Log | EventLog`. Skip raw logs that
          // didn't decode against the ABI (defensive — shouldn't
          // happen for our own contracts, but cheap to guard).
          if (!('args' in ev) || !ev.args) continue;
          try {
            const args = Array.from(ev.args as any);
            await binding.handler(...args, ev as EventLog);
          } catch (handlerErr: any) {
            console.error(
              `[${label}] handler for ${binding.eventName} threw:`,
              handlerErr?.message ?? handlerErr
            );
          }
        }
      }

      lastProcessed = toBlock;
    } catch (err: any) {
      // Keep the cursor where it is and retry next tick. Transient
      // RPC errors (429, upstream timeouts) are common on public
      // endpoints; one log per failure is enough noise.
      console.warn(`[${label}] poll failed, will retry:`, err?.shortMessage ?? err?.message ?? err);
    } finally {
      isPolling = false;
    }
  };

  const pollHandle = startAdaptivePoll({
    label,
    activeIntervalMs: intervalMs,
    idleIntervalMs,
    isActive,
    isAttentive,
    tick,
  });

  console.log(
    `[${label}] from block ${lastProcessed}, ${bindings.length} event(s) — active ${intervalMs / 1000}s / idle ${idleIntervalMs / 1000}s`
  );

  return {
    stop() { pollHandle.stop(); },
    wake() { pollHandle.wake(); },
    cursor() { return lastProcessed; },
  };
}
