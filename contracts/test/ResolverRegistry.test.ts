import { expect } from "chai";
import { ethers } from "hardhat";
import { ResolverRegistry, TestERC20 } from "../../typechain-types";

const MIN_STAKE = ethers.parseEther("100");

async function deploy() {
  const [owner, beneficiary] = await ethers.getSigners();
  const Token = await ethers.getContractFactory("TestERC20");
  const token = (await Token.deploy("Stake", "STK", ethers.parseEther("1000000"))) as unknown as TestERC20;

  const Registry = await ethers.getContractFactory("ResolverRegistry");
  const registry = (await Registry.deploy(
    await token.getAddress(),
    MIN_STAKE,
    beneficiary.address,
    owner.address
  )) as unknown as ResolverRegistry;

  return { owner, beneficiary, token, registry };
}

describe("ResolverRegistry v2", () => {
  it("registers a resolver with sufficient stake", async () => {
    const [, , , resolver] = await ethers.getSigners();
    const { token, registry } = await deploy();
    await token.transfer(resolver.address, MIN_STAKE * 2n);
    await token.connect(resolver).approve(await registry.getAddress(), MIN_STAKE);

    await expect(registry.connect(resolver).register(MIN_STAKE))
      .to.emit(registry, "Registered")
      .withArgs(resolver.address, MIN_STAKE);

    expect(await registry.isActive(resolver.address)).to.be.true;
    expect(await registry.listLength()).to.equal(1);
  });

  it("rejects stake below minimum", async () => {
    const [, , , resolver] = await ethers.getSigners();
    const { token, registry } = await deploy();
    const tooSmall = MIN_STAKE - 1n;
    await token.transfer(resolver.address, tooSmall);
    await token.connect(resolver).approve(await registry.getAddress(), tooSmall);

    await expect(
      registry.connect(resolver).register(tooSmall)
    ).to.be.revertedWithCustomError(registry, "StakeBelowMinimum");
  });

  it("rejects duplicate registration", async () => {
    const [, , , resolver] = await ethers.getSigners();
    const { token, registry } = await deploy();
    await token.transfer(resolver.address, MIN_STAKE * 2n);
    await token.connect(resolver).approve(await registry.getAddress(), MIN_STAKE * 2n);
    await registry.connect(resolver).register(MIN_STAKE);
    await expect(
      registry.connect(resolver).register(MIN_STAKE)
    ).to.be.revertedWithCustomError(registry, "AlreadyRegistered");
  });

  it("allows increaseStake and unregister", async () => {
    const [, , , resolver] = await ethers.getSigners();
    const { token, registry } = await deploy();
    await token.transfer(resolver.address, MIN_STAKE * 3n);
    await token.connect(resolver).approve(await registry.getAddress(), MIN_STAKE * 3n);
    await registry.connect(resolver).register(MIN_STAKE);
    await registry.connect(resolver).increaseStake(MIN_STAKE);
    const info = await registry.get(resolver.address);
    expect(info.stake).to.equal(MIN_STAKE * 2n);

    const before = await token.balanceOf(resolver.address);
    await registry.connect(resolver).unregister();
    expect(await token.balanceOf(resolver.address)).to.equal(before + MIN_STAKE * 2n);
    expect(await registry.isActive(resolver.address)).to.be.false;
  });

  it("slash routes funds to slashBeneficiary and deactivates if stake falls below minimum", async () => {
    const [, beneficiary, , resolver] = await ethers.getSigners();
    const { token, registry } = await deploy();
    await token.transfer(resolver.address, MIN_STAKE * 2n);
    await token.connect(resolver).approve(await registry.getAddress(), MIN_STAKE * 2n);
    await registry.connect(resolver).register(MIN_STAKE * 2n);

    const benBefore = await token.balanceOf(beneficiary.address);
    await registry.slash(resolver.address, MIN_STAKE + 1n);
    expect(await token.balanceOf(beneficiary.address)).to.equal(benBefore + MIN_STAKE + 1n);

    // Remaining stake (MIN_STAKE - 1) < minimum → deactivated.
    expect(await registry.isActive(resolver.address)).to.be.false;
    const info = await registry.get(resolver.address);
    expect(info.totalSlashed).to.equal(MIN_STAKE + 1n);
  });

  it("only owner can slash", async () => {
    const [, , , resolver] = await ethers.getSigners();
    const { token, registry } = await deploy();
    await token.transfer(resolver.address, MIN_STAKE);
    await token.connect(resolver).approve(await registry.getAddress(), MIN_STAKE);
    await registry.connect(resolver).register(MIN_STAKE);

    await expect(
      registry.connect(resolver).slash(resolver.address, 1n)
    ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
  });
});
