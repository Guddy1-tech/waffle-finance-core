import { describe, it, expect } from "vitest";
import { generateSecret, hashSecret, verifyPreimage } from "../src/secrets/index.js";

describe("secrets", () => {
  it("generates a 32-byte secret with both digests", () => {
    const s = generateSecret();
    expect(s.preimage).toMatch(/^0x[0-9a-f]{64}$/);
    expect(s.sha256).toMatch(/^0x[0-9a-f]{64}$/);
    expect(s.keccak256).toMatch(/^0x[0-9a-f]{64}$/);
    expect(s.sha256).not.toBe(s.keccak256);
  });

  it("hashSecret is deterministic", () => {
    const s = generateSecret();
    const s2 = hashSecret(s.preimage);
    expect(s2.sha256).toBe(s.sha256);
    expect(s2.keccak256).toBe(s.keccak256);
  });

  it("verifyPreimage detects both sha256 and keccak256 commitments", () => {
    const s = generateSecret();
    expect(verifyPreimage(s.preimage, s.sha256)).toBe("sha256");
    expect(verifyPreimage(s.preimage, s.keccak256)).toBe("keccak256");
    const other = generateSecret();
    expect(verifyPreimage(s.preimage, other.sha256)).toBeNull();
  });
});
