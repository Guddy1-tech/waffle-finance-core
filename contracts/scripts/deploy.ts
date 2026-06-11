import { ethers, network } from "hardhat";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Stelleth v2 deployment script.
 *
 * Deploys ResolverRegistry + HTLCEscrow on the configured network and
 * writes the addresses to `deployments.<network>.json` at the repo root,
 * which the coordinator and frontend pick up via env vars.
 *
 * Usage:
 *   pnpm hardhat run scripts/v2/deploy.ts --network sepolia
 *   pnpm hardhat run scripts/v2/deploy.ts --network mainnet
 *
 * Required env vars:
 *   - RELAYER_PRIVATE_KEY (deployer; will be the registry owner)
 *   - V2_STAKE_ASSET (ERC20 used for resolver staking on this network;
 *     e.g. USDC on mainnet, a TestERC20 on sepolia)
 *   - V2_MIN_STAKE (in wei of the stake asset)
 *   - V2_MIN_SAFETY_DEPOSIT (in wei of native ETH; default: 0)
 */

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Network:  ${network.name}`);

  const stakeAsset = process.env.V2_STAKE_ASSET;
  if (!stakeAsset) {
    throw new Error("V2_STAKE_ASSET env var is required");
  }
  const minStake = BigInt(process.env.V2_MIN_STAKE ?? "0");
  const minSafetyDeposit = BigInt(process.env.V2_MIN_SAFETY_DEPOSIT ?? "0");

  console.log("Deploying ResolverRegistry...");
  const Registry = await ethers.getContractFactory("ResolverRegistry");
  const registry = await Registry.deploy(
    stakeAsset,
    minStake,
    deployer.address, // slashBeneficiary (move to DAO/treasury later)
    deployer.address  // owner (move to DAO/multisig later)
  );
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`  ResolverRegistry @ ${registryAddress}`);

  console.log("Deploying HTLCEscrow...");
  const Escrow = await ethers.getContractFactory("HTLCEscrow");
  const escrow = await Escrow.deploy(registryAddress, minSafetyDeposit);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log(`  HTLCEscrow @ ${escrowAddress}`);

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    ethereum: {
      htlcEscrow: escrowAddress,
      resolverRegistry: registryAddress
    },
    config: {
      stakeAsset,
      minStake: minStake.toString(),
      minSafetyDeposit: minSafetyDeposit.toString()
    },
    deployedAt: new Date().toISOString()
  };

  // Repo root deployments file: contracts/../deployments.<network>.json
  const outPath = path.resolve(__dirname, `../../../deployments.${network.name}.json`);
  let existing: any = {};
  if (fs.existsSync(outPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
    } catch {
      existing = {};
    }
  }
  const merged = { ...existing, ...out, ethereum: out.ethereum };
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));
  console.log(`\nDeployment summary written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
