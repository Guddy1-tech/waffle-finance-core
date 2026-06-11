import { describe, it, expect } from "vitest";
import {
  canTransition,
  InvalidTransitionError,
  isTerminal,
  nextStatesOf,
  requireTransition
} from "../src/state-machine/index.js";

describe("order state machine", () => {
  it("allows the happy path: announced -> src_locked -> dst_locked -> secret_revealed -> completed", () => {
    requireTransition("announced", "src_locked");
    requireTransition("src_locked", "dst_locked");
    requireTransition("dst_locked", "secret_revealed");
    requireTransition("secret_revealed", "completed");
  });

  it("allows refund from any pre-terminal state", () => {
    expect(canTransition("src_locked", "refunded")).toBe(true);
    expect(canTransition("dst_locked", "refunded")).toBe(true);
    expect(canTransition("secret_revealed", "refunded")).toBe(true);
    expect(canTransition("expired", "refunded")).toBe(true);
  });

  it("rejects invalid transitions", () => {
    expect(() => requireTransition("announced", "completed")).toThrow(InvalidTransitionError);
    expect(canTransition("completed", "announced")).toBe(false);
  });

  it("marks terminal states correctly", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("refunded")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("announced")).toBe(false);
    expect(isTerminal("src_locked")).toBe(false);
  });

  it("nextStatesOf returns a stable list", () => {
    expect(nextStatesOf("announced")).toEqual(["src_locked", "failed", "expired"]);
    expect(nextStatesOf("completed")).toEqual([]);
  });
});
