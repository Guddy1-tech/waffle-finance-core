import type { Logger } from "pino";

export interface PriceQuote {
  pair: string;
  /** Decimal string. `srcUsd` and `dstUsd` are USD per unit of src/dst. */
  srcUsd: string | null;
  dstUsd: string | null;
  /** Source: coingecko, oneinch, cache, etc. */
  source: "coingecko" | "oneinch" | "cache" | "unknown";
  /** Unix ms when the quote was fetched. */
  fetchedAt: number;
}

/**
 * Minimal real-data price service. Reads from CoinGecko's free
 * (no-API-key) endpoint; if the call fails we surface a `null` price
 * instead of a fabricated number, so callers can decide to render
 * "price unavailable" rather than misleading data.
 */
export class QuoteService {
  private readonly cache = new Map<string, PriceQuote>();
  private readonly cacheTtlMs = 30_000;

  constructor(private readonly log: Logger) {}

  async quoteEthXlm(): Promise<{ ethUsd: string | null; xlmUsd: string | null; source: PriceQuote["source"]; fetchedAt: number }> {
    const cached = this.cache.get("ETH-XLM");
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return {
        ethUsd: cached.srcUsd,
        xlmUsd: cached.dstUsd,
        source: "cache",
        fetchedAt: cached.fetchedAt
      };
    }
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,stellar&vs_currencies=usd",
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) throw new Error(`coingecko ${res.status}`);
      const body = (await res.json()) as Record<string, { usd?: number }>;
      const ethUsd = body.ethereum?.usd?.toString() ?? null;
      const xlmUsd = body.stellar?.usd?.toString() ?? null;
      const quote: PriceQuote = {
        pair: "ETH-XLM",
        srcUsd: ethUsd,
        dstUsd: xlmUsd,
        source: "coingecko",
        fetchedAt: Date.now()
      };
      this.cache.set("ETH-XLM", quote);
      return { ethUsd, xlmUsd, source: "coingecko", fetchedAt: quote.fetchedAt };
    } catch (err) {
      this.log.warn({ err }, "coingecko quote failed");
      return { ethUsd: null, xlmUsd: null, source: "unknown", fetchedAt: Date.now() };
    }
  }
}
