import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();

collectDefaultMetrics({ register: registry, prefix: "coordinator_" });

/** Total orders by status and direction labels */
export const ordersTotal = new Counter({
  name: "coordinator_orders_total",
  help: "Total number of orders by status and direction",
  labelNames: ["status", "direction"] as const,
  registers: [registry]
});

/** Last block number seen by each listener */
export const listenerLastBlock = new Gauge({
  name: "coordinator_listener_last_block",
  help: "Most recent block processed by each chain listener",
  labelNames: ["chain"] as const,
  registers: [registry]
});

/** HTTP request duration histogram */
export const httpRequestDuration = new Histogram({
  name: "coordinator_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry]
});

/** End-to-end swap completion latency in seconds */
export const swapDuration = new Histogram({
  name: "coordinator_swap_duration_seconds",
  help: "Time from order announcement to terminal state (completed or refunded)",
  labelNames: ["direction", "outcome"] as const,
  buckets: [30, 60, 120, 180, 300, 600, 900, 1800, 3600],
  registers: [registry]
});

/** Active orders currently in flight */
export const activeOrders = new Gauge({
  name: "coordinator_active_orders",
  help: "Number of orders not yet in a terminal state",
  labelNames: ["direction"] as const,
  registers: [registry]
});
