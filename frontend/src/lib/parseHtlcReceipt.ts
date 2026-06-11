import { decodeEventLog, type Hex } from "viem";

/**
 * ABI fragments for the two HTLC versions Stelleth currently supports.
 *
 * v1 `MainnetHTLC.OrderCreated` keys the order by a bytes32 hash, while
 * v2 `HTLCEscrow.OrderCreated` uses a monotonic uint256 id. We try both
 * decodes so a single helper works regardless of which contract the
 * relayer happens to deploy ETH into.
 */
const V1_HTLC_ABI = [
  {
    type: "event",
    name: "OrderCreated",
    inputs: [
      { name: "orderId", type: "bytes32", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "beneficiary", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "hashLock", type: "bytes32", indexed: false },
      { name: "timelock", type: "uint256", indexed: false },
    ],
  },
] as const;

const V2_HTLC_ABI = [
  {
    type: "event",
    name: "OrderCreated",
    inputs: [
      { name: "orderId", type: "uint256", indexed: true },
      { name: "sender", type: "address", indexed: true },
      { name: "beneficiary", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "safetyDeposit", type: "uint256", indexed: false },
      { name: "hashlock", type: "bytes32", indexed: false },
      { name: "timelock", type: "uint64", indexed: false },
    ],
  },
] as const;

export interface ParsedHtlcOrder {
  contractMode: "v1-mainnet-htlc" | "v2-escrow";
  contractAddress: string;
  /** Decimal string for v2 (uint256) or 0x-prefixed bytes32 hex for v1. */
  orderId: string;
  amountWei: string;
  timelockUnixSeconds: number;
}

interface RawLog {
  address: string;
  topics: string[];
  data: string;
}

function toLogInput(log: RawLog) {
  return {
    address: log.address as `0x${string}`,
    topics: log.topics as [Hex, ...Hex[]],
    data: log.data as Hex,
  };
}

/**
 * Scan an Ethereum tx receipt's logs for an HTLC `OrderCreated` event and
 * return the metadata needed for a permissionless refund.
 *
 * Returns `null` if no recognised HTLC event is present (e.g. the user
 * sent a plain transfer, or the relayer used an unrelated contract).
 */
export function parseHtlcReceipt(logs: RawLog[] | undefined | null): ParsedHtlcOrder | null {
  if (!logs || logs.length === 0) return null;

  for (const raw of logs) {
    if (!raw?.topics?.length || !raw.data) continue;
    const input = toLogInput(raw);

    // v2 first — it's the active deployment for testnet today and the
    // forward-looking format for mainnet at v2 launch.
    try {
      const decoded = decodeEventLog({ abi: V2_HTLC_ABI, ...input });
      if (decoded.eventName === "OrderCreated") {
        const args = decoded.args as {
          orderId: bigint;
          amount: bigint;
          timelock: bigint;
        };
        return {
          contractMode: "v2-escrow",
          contractAddress: raw.address,
          orderId: args.orderId.toString(),
          amountWei: args.amount.toString(),
          timelockUnixSeconds: Number(args.timelock),
        };
      }
    } catch {
      // fall through to v1
    }

    try {
      const decoded = decodeEventLog({ abi: V1_HTLC_ABI, ...input });
      if (decoded.eventName === "OrderCreated") {
        const args = decoded.args as {
          orderId: `0x${string}`;
          amount: bigint;
          timelock: bigint;
        };
        return {
          contractMode: "v1-mainnet-htlc",
          contractAddress: raw.address,
          orderId: args.orderId,
          amountWei: args.amount.toString(),
          timelockUnixSeconds: Number(args.timelock),
        };
      }
    } catch {
      // not an HTLC OrderCreated log; keep scanning
    }
  }

  return null;
}
