declare module "@nomicfoundation/hardhat-network-helpers" {
	export const time: any;
	export function mine(...args: any[]): any;
	export function setAutomine(v: any): any;
}

declare module "@nomicfoundation/hardhat-ethers/signers" {
	export type SignerWithAddress = any;
	export type HardhatEthersSigner = any;
}
