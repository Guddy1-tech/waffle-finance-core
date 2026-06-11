import { rpc } from "@stellar/stellar-sdk";
import type { Logger } from "pino";
import type { CoordinatorConfig } from "../config.js";
import type { OrderService } from "../services/order-service.js";
import { listenerLastBlock } from "../metrics.js";

/**
 * Polls the Soroban RPC for HTLC contract events and feeds them into
 * the OrderService.
 */
export class SorobanListener {
  private readonly server: rpc.Server;
  private readonly log: Logger;
  private cursor: string | undefined;
  private stopped = false;

  constructor(
    private readonly cfg: CoordinatorConfig,
    private readonly orders: OrderService,
    log: Logger
  ) {
    this.log = log.child({ component: "SorobanListener" });
    this.server = new rpc.Server(cfg.soroban.rpcUrl, {
      allowHttp: cfg.soroban.rpcUrl.startsWith("http://")
    });
  }

  start(): void {
    if (!this.cfg.soroban.htlcContract) {
      this.log.warn("SOROBAN_HTLC contract not configured — Soroban listener disabled");
      return;
    }
    const contractId = this.cfg.soroban.htlcContract;
    this.log.info({ contract: contractId }, "starting");
    void this.loop(contractId);
  }

  stop(): void {
    this.stopped = true;
  }

  private async loop(contractId: string): Promise<void> {
    while (!this.stopped) {
      try {
        const latest = await this.server.getLatestLedger();
        listenerLastBlock.set({ chain: "soroban" }, latest.sequence);
        const startLedger = this.cursor === undefined ? latest.sequence - 1 : undefined;
        const events = await this.server.getEvents({
          filters: [{ type: "contract", contractIds: [contractId] }],
          startLedger: startLedger,
          cursor: this.cursor,
          limit: 100
        });
        for (const ev of events.events) {
          this.log.info(
            { ledger: ev.ledger, txHash: ev.txHash, topics: ev.topic?.length ?? 0 },
            "Soroban event"
          );
          // Topic parsing is contract-specific; the SDK module in Phase 5
          // exposes a typed decoder. Until then we log raw events and let
          // the user/resolver post `/orders/:id/dst-locked` once they
          // identify the matching public id.
        }
        if (events.cursor) this.cursor = events.cursor;
      } catch (err) {
        this.log.warn({ err }, "Soroban poll failed");
      }
      await new Promise((r) => setTimeout(r, this.cfg.pollIntervalMs));
    }
  }
}
