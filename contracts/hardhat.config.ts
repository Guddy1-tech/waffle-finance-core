import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from root directory
dotenvConfig({ path: resolve(__dirname, '../.env') });

function resolveHardhatRpc(network: 'sepolia' | 'mainnet'): string {
  const infuraKey = process.env.INFURA_API_KEY?.trim();
  if (network === 'sepolia') {
    return (
      process.env.SEPOLIA_RPC_URL?.trim() ||
      process.env.ETHEREUM_RPC_URL?.trim() ||
      (infuraKey ? `https://sepolia.infura.io/v3/${infuraKey}` : '') ||
      'https://ethereum-sepolia-rpc.publicnode.com'
    );
  }
  return (
    process.env.MAINNET_RPC_URL?.trim() ||
    process.env.ETHEREUM_RPC_URL?.trim() ||
    (infuraKey ? `https://mainnet.infura.io/v3/${infuraKey}` : '') ||
    'https://ethereum-rpc.publicnode.com'
  );
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    sepolia: {
      url: resolveHardhatRpc('sepolia'),
      chainId: 11155111,
      accounts: process.env.RELAYER_PRIVATE_KEY ? [process.env.RELAYER_PRIVATE_KEY] : [],
    },
    mainnet: {
      url: resolveHardhatRpc('mainnet'),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : (process.env.RELAYER_PRIVATE_KEY ? [process.env.RELAYER_PRIVATE_KEY] : []),
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config; 