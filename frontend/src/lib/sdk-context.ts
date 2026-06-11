import { createPublicClient, createWalletClient, custom, http, type Address } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { EthereumHTLCClient } from "@stelleth/sdk";
import { isTestnet } from "../config/networks";
import { resolveViteMainnetRpcUrl, resolveViteSepoliaRpcUrl } from "../config/rpc-urls";

function htlcAddress(): Address | null {
  const env = (import.meta as any).env;
  const addr = isTestnet()
    ? env.VITE_ETH_HTLC_ESCROW_TESTNET
    : env.VITE_ETH_HTLC_ESCROW_MAINNET;
  if (!addr) return null;
  return addr as Address;
}

/**
 * Build an `EthereumHTLCClient` from the user's injected wallet
 * (MetaMask, Rabby, etc). Returns `null` if no contract is configured
 * for the current network or no wallet is available.
 *
 * This is intentionally minimal — wagmi's hooks already manage chain
 * switching, account selection, and signing prompts elsewhere in the
 * app. The SDK client lives next to whichever wallet flow needs it.
 */
export async function makeEthereumHTLCClient(userAddress: Address): Promise<EthereumHTLCClient | null> {
  const address = htlcAddress();
  if (!address) return null;
  if (typeof window === "undefined" || !window.ethereum) return null;

  const chain = isTestnet() ? sepolia : mainnet;
  const rpcUrl = isTestnet() ? resolveViteSepoliaRpcUrl() : resolveViteMainnetRpcUrl();

  const publicClient = createPublicClient({
    chain,
    transport: rpcUrl ? http(rpcUrl) : http()
  });
  const walletClient = createWalletClient({
    chain,
    transport: custom(window.ethereum),
    account: userAddress
  });

  return new EthereumHTLCClient({ address, publicClient, walletClient });
}

export function getEthereumHtlcAddress(): Address | null {
  return htlcAddress();
}
