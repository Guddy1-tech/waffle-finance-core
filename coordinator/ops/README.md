# Coordinator Observability — Prometheus + Grafana

Local reference stack for the Stelleth coordinator. **Not required in production** — Render deployments can point any external Prometheus at the `/metrics` endpoint.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Engine ≥ 24)
- Coordinator running locally on port **3000** (`pnpm dev` inside `coordinator/`)

---

## Quick Start (< 15 commands)

```bash
# 1. Install prom-client (first time only)
cd coordinator && pnpm install

# 2. Start the coordinator
pnpm dev

# 3. Verify metrics are served
curl http://localhost:3000/metrics | head -20

# 4. In a second terminal, start the observability stack
cd coordinator/ops
docker compose up -d

# 5. Open Prometheus
open http://localhost:9090

# 6. Open Grafana  (admin / stelleth)
open http://localhost:3001
```

The **Stelleth Coordinator** dashboard is pre-loaded in Grafana under the *Stelleth* folder.

---

## Exported Metrics

| Metric | Type | Description |
|---|---|---|
| `coordinator_orders_total` | Counter | Orders counted by `status` label |
| `coordinator_listener_last_block` | Gauge | Latest block processed, by `chain` label (`ethereum` / `soroban`) |
| `coordinator_http_request_duration_seconds` | Histogram | HTTP latency by `method`, `route`, `status_code` |
| `coordinator_process_*` | (default) | Node.js process metrics (heap, CPU, event-loop lag) |

---

## Prometheus Scrape Config

Edit `ops/prometheus.yml` if the coordinator runs on a different host/port:

```yaml
scrape_configs:
  - job_name: "stelleth-coordinator"
    static_configs:
      - targets: ["host.docker.internal:3000"]   # change as needed
    metrics_path: /metrics
```

For a remote coordinator (e.g. Render), replace the target with the public URL and add any required auth headers.

---

## Key Dashboard Panels

| Panel | What to watch |
|---|---|
| **Orders by Status** | Flat/falling curve → listener stalled |
| **Listener Last Block** | Should increase every ~12 s (ETH) / ~5 s (Soroban) |
| **HTTP p95 latency** | Alert if > 500 ms |
| **Process Heap** | Alert if growing unbounded (memory leak) |

---

## Suggested Alerts

```yaml
# coordinator/ops/prometheus.yml — add under rule_files / alerting as needed

- alert: CoordinatorDown
  expr: up{job="stelleth-coordinator"} == 0
  for: 2m
  labels:
    severity: critical
  annotations:
    summary: "Coordinator is unreachable"

- alert: ListenerStale
  expr: time() - coordinator_listener_last_block > 120
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Listener has not advanced for > 2 minutes"
```

---

## Tear Down

```bash
docker compose down -v   # removes volumes (Grafana state)
```
