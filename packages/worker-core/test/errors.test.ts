import { describe, expect, it } from "vitest";

import { SorobanRpcError } from "@orbital-stellar/pulse-core";

import { classifySubmissionError } from "../src/index.js";

describe("classifySubmissionError: failure kinds", () => {
  it("classifies an insufficient-fee result code as retryable", () => {
    const failure = classifySubmissionError({
      message: "op failed",
      result_code: "tx_insufficient_fee",
    });
    expect(failure.kind).toBe("insufficient_fee");
    expect(failure.retryable).toBe(true);
  });

  it("classifies ledger contention as retryable", () => {
    expect(
      classifySubmissionError({ message: "op failed", result_code: "tx_duplication" }).kind,
    ).toBe("ledger_contention");
    expect(classifySubmissionError(new Error("tx_duplication")).kind).toBe("ledger_contention");
    expect(classifySubmissionError(new Error("tx_too_early")).retryable).toBe(true);
  });

  it("classifies rate limiting as retryable", () => {
    const failure = classifySubmissionError(new Error("429 too many requests"));
    expect(failure.kind).toBe("rate_limit");
    expect(failure.retryable).toBe(true);
  });

  it("classifies timeout and socket failures as rpc_timeout", () => {
    expect(classifySubmissionError(new Error("request timeout")).kind).toBe("rpc_timeout");
    expect(classifySubmissionError(new Error("ECONNRESET")).kind).toBe("rpc_timeout");
    expect(classifySubmissionError(new Error("socket hang up")).kind).toBe("rpc_timeout");
  });

  it("classifies contract rejections as terminal", () => {
    const failure = classifySubmissionError(new Error("tx_failed: wasm trap"));
    expect(failure.kind).toBe("contract_rejection");
    expect(failure.retryable).toBe(false);
  });

  it("classifies unauthorized failures as terminal", () => {
    expect(classifySubmissionError(new Error("HTTP 403")).kind).toBe("unauthorized");
    expect(classifySubmissionError(new Error("unauthorised")).retryable).toBe(false);
  });

  it("falls back to unknown for an unrecognised failure", () => {
    const failure = classifySubmissionError(new Error("some opaque failure"));
    expect(failure.kind).toBe("unknown");
    expect(failure.retryable).toBe(false);
    expect(failure.cause).toBeInstanceOf(Error);
  });
});

describe("classifySubmissionError: Soroban RPC code mapping", () => {
  it("maps every Soroban RPC code to a failure kind", () => {
    expect(
      classifySubmissionError(new SorobanRpcError("x", { code: "network", retryable: true })).kind,
    ).toBe("rpc_network");
    expect(
      classifySubmissionError(new SorobanRpcError("x", { code: "rate_limit", retryable: true }))
        .kind,
    ).toBe("rate_limit");
    expect(
      classifySubmissionError(new SorobanRpcError("x", { code: "server", retryable: true })).kind,
    ).toBe("rpc_timeout");
    expect(
      classifySubmissionError(new SorobanRpcError("x", { code: "auth", retryable: false })).kind,
    ).toBe("unauthorized");
    expect(
      classifySubmissionError(
        new SorobanRpcError("x", { code: "invalid_request", retryable: false }),
      ).kind,
    ).toBe("contract_invalid");
    expect(
      classifySubmissionError(new SorobanRpcError("x", { code: "unknown", retryable: false })).kind,
    ).toBe("contract_invalid");
  });

  it("preserves the message, retryable flag and cause from the RPC error", () => {
    const rpcError = new SorobanRpcError("server exploded", { code: "server", retryable: true });
    const failure = classifySubmissionError(rpcError);
    expect(failure.message).toBe("server exploded");
    expect(failure.retryable).toBe(true);
    expect(failure.cause).toBe(rpcError);
  });
});
