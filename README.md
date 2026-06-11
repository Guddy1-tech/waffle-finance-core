<p align="center">
  <img src="frontend/public/images/stelleth-logo.png" alt="Stelleth" width="200" />
</p>

<h1 align="center">Stelleth</h1>

<p align="center">
  <strong>Non-custodial Ethereum ↔ Stellar atomic swap bridge</strong><br/>
  No validator set. No attester. No admin escape hatch.
</p>

<p align="center">
  <a href="https://sepolia.etherscan.io/address/0xb352339BEb146f2699d28D736700B953988bB178">Sepolia Contract</a> ·
  <a href="https://stellar.expert/explorer/testnet/contract/CDIKSJKVMXKGBRD3BBEBMF7Q4GQJ52ECU6R6G5HEKXKXVGGWK2CTA6JK">Stellar Testnet</a> ·
  <a href="https://github.com/karagozemin/Stelleth-1nchFusion/actions">CI</a>
</p>

---

## What it is

Stelleth locks funds in Hash Time-Lock Contracts (HTLCs) on both chains simultaneously. Settlement is a `sha256` preimage reveal — not a multisig, not an attester signature.

If anything fails — coordinator down, resolver offline, RPC unavailable, frontend unreachable — locked funds either settle to the beneficiary or refund permissionlessly to the user. There is no state where funds are stuck under operator control.

> **Status:** Live on testnet (Sepolia + Stellar testnet). Mainnet gated until independent audit (Q1 2027).

---

## How it works

```
User locks ETH (24h timelock)       →    Resolver locks XLM (12h timelock)
                                                       ↓
                                          User claims XLM, revealing secret
                                                       ↓
Resolver claims ETH using secret    ←    Secret is now public on-chain
```

Both legs settle, or both legs refund. The 12h vs 24h timelock gap ensures the resolver's destination refund always expires before the user's source — so neither party can be stuck.

---

## Trust model

Funds move under exactly two conditions:

1. A caller submits a preimage where `sha256(preimage) == hashlock` before `timelock` — funds go to `beneficiary`
2. `timelock` has expired — anyone calls `refundOrder` and funds return to `refundAddress` (always the original user)

The coordinator is a metadata service that never signs transactions touching user funds. Resolvers stake into `ResolverRegistry`; misbehaviour is slashable on-chain.

| Attack vector | Validator-set bridge | Stelleth |
|---|---|---|
| Compromise off-chain signers | **Funds lost** | No effect — no signers |
| Compromise first-party attester | **Funds lost** | No effect — no attesters |
| Break sha256 | Safe | Funds at risk (breaks all of crypto) |
| Compromise chain consensus | Funds at risk | Funds at risk (inherited) |

---

## Deployed contracts (testnet)

| Contract | Chain | Address |
|---|---|---|
| `HTLCEscrow` | Sepolia | [`0xb352339BEb…988bB178`](https://sepolia.etherscan.io/address/0xb352339BEb146f2699d28D736700B953988bB178) |
| `ResolverRegistry` | Sepolia | [`0x7D9ce70Aa4…1B6D1D99`](https://sepolia.etherscan.io/address/0x7D9ce70Aa40E144E8BbE266a0dc3b3F91B6D1D99) |
| `stelleth-htlc` | Stellar testnet | [`CDIKSJKV…CTA6JK`](https://stellar.expert/explorer/testnet/contract/CDIKSJKVMXKGBRD3BBEBMF7Q4GQJ52ECU6R6G5HEKXKXVGGWK2CTA6JK) |
| `stelleth-resolver-registry` | Stellar testnet | [`CBSR7Z4M…Z4WGF`](https://stellar.expert/explorer/testnet/contract/CBSR7Z4MHLPMLFFM5K3PK3YLZAVCOMJ4KPVRWO4VPL3FF64MSTIZ4WGF) |

---

## Refund layers

Four independent recovery mechanisms — each a backstop for the previous one.

| Layer | Trigger | Latency |
|---|---|---|
| On-chain HTLC refund | `timelock` expires; anyone calls `refundOrder` | ≤ 24h |
| Frontend refund dialog | "Refund ETH" button in transaction history | User-driven |
| Automatic XLM refund | ETH leg fails mid-request; relayer refunds inline | < 30s |
| Background watchdog | XLM→ETH swap pending > 5 min; scans every 60s | < 6 min |

Even with the coordinator, relayer, and frontend all offline, layer 1 alone is sufficient — the user calls `refundOrder` directly from any wallet.

---

## Repository layout

```
contracts/          Solidity — HTLCEscrow + ResolverRegistry
  contracts/        Contract source (HTLCEscrow.sol, ResolverRegistry.sol)
  scripts/          Deployment scripts
  test/             Hardhat + Foundry tests

soroban/            Rust — Soroban HTLC + ResolverRegistry for Stellar
  contracts/htlc/
  contracts/resolver-registry/

packages/sdk/       @stelleth/sdk — shared TS types, state machine, secrets

coordinator/        Order book service (SQLite, REST/WS, never holds user keys)
  src/
    listeners/      Ethereum + Soroban event listeners
    services/       OrderService, SecretService, QuoteService
    persistence/    SQLite schema and repository
    server/         Express routes (/orders, /quotes, /secrets, /metrics)
    state-machine/  Shared order state machine

relayer/            Bridge relay service
  src/
    listeners/      Block polling, contract event poller, ETH monitor
    services/       Gas tracker, refund watchdog, XLM refund, recovery
    utils/          Adaptive poll, site presence, RPC helpers
    events/         Event handlers, client subscriptions

resolver/           Open-source resolver runner + Docker image
frontend/           React + Vite dApp (testnet-only)
e2e/                Cross-chain differential test harness
```

---

## Quick start

Requirements: Node 22.5+, pnpm 9+, Rust + `stellar-cli`, Foundry.

```bash
git clone https://github.com/karagozemin/Stelleth-1nchFusion
cd Stelleth-1nchFusion
pnpm install
cp env.example .env          # fill in RPC URLs and private keys
```

```bash
# Build shared SDK
pnpm --filter @stelleth/sdk build

# Compile + test Solidity contracts
pnpm --filter @stelleth/contracts exec hardhat test

# Test Soroban contracts
cd soroban && cargo test --release && cd ..

# Run cross-chain differential harness (no live RPC needed)
pnpm test:e2e

# Start coordinator
pnpm --filter @stelleth/coordinator dev

# Start frontend
pnpm --filter @stelleth/frontend dev
```

---

## Running a resolver

Anyone who stakes into `ResolverRegistry` can run a resolver. The runner handles order discovery, destination locking, and source claiming automatically.

```bash
docker run ghcr.io/stelleth/resolver:latest register
docker run ghcr.io/stelleth/resolver:latest run
```

See [`resolver/`](resolver/) for environment variable reference and configuration options.

---

## Deploying contracts

```bash
cp env.example .env   # set RELAYER_PRIVATE_KEY, V2_STAKE_ASSET, V2_MIN_STAKE

# Sepolia testnet
pnpm --filter @stelleth/contracts exec hardhat run scripts/deploy.ts --network sepolia

# Mainnet (after audit)
pnpm --filter @stelleth/contracts exec hardhat run scripts/deploy.ts --network mainnet
```

Deployment addresses are written to `deployments.<network>.json` at the repo root, which the coordinator and frontend pick up automatically.

---

## Test coverage

| Layer | Tests | Framework |
|---|---|---|
| Soroban HTLC | 10 | Rust `#[contracttest]` |
| Soroban ResolverRegistry | 6 | Rust `#[contracttest]` |
| EVM HTLCEscrow | 15 | Hardhat + Chai |
| EVM ResolverRegistry | 6 | Hardhat + Chai |
| SDK | 8 | Vitest |
| Coordinator | 4 | Vitest |

All suites gate every pull request via GitHub Actions.

---

## Environment variables

Key variables in `env.example`:

| Variable | Used by | Description |
|---|---|---|
| `ETHEREUM_RPC_URL` | relayer, coordinator | Sepolia or mainnet RPC endpoint |
| `RELAYER_PRIVATE_KEY` | relayer | ETH signing key for relayer transactions |
| `RELAYER_STELLAR_SECRET` | relayer | Stellar signing key for relayer transactions |
| `V2_STAKE_ASSET` | contracts deploy | ERC-20 address used for resolver staking |
| `NETWORK_MODE` | relayer, frontend | `testnet` or `mainnet` |
| `VITE_MAINNET_ENABLED` | frontend | Set `true` only after audit to enable mainnet UI |

---

## License

MIT. See [`LICENSE`](LICENSE).
