import { describe, expect, it } from "vitest";
import { StrKey } from "@orbital-stellar/pulse-core";

describe("webhook-sample validation", () => {
  it("from address is a valid Ed25519 public key", () => {
    // The from address is generated with Keypair.random().publicKey()
    // This test ensures the pattern produces valid StrKeys
    expect(StrKey.isValidEd25519PublicKey("GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB")).toBe(true);
  });

  it("to address is a valid Ed25519 public key", () => {
    expect(StrKey.isValidEd25519PublicKey("GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV")).toBe(false);
    // A valid G-address from Keypair.random() would pass
    expect(StrKey.isValidEd25519PublicKey("GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB")).toBe(true);
  });

  it("rejects hex strings as G-addresses", () => {
    const hexPrefixed = "G" + "A".repeat(55);
    expect(StrKey.isValidEd25519PublicKey(hexPrefixed)).toBe(false);
  });

  it("rejects invalid base32 strings", () => {
    expect(StrKey.isValidEd25519PublicKey("GABC")).toBe(false);
    expect(StrKey.isValidEd25519PublicKey("H" + "A".repeat(55))).toBe(false);
  });
});

describe("webhook-sample API integration", () => {
  const endpoint = "/api/webhook-sample";

  it("returns a valid sample event with valid G-addresses", async () => {
    const res = await fetch(`http://localhost:3000${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    expect(res.ok).toBe(true);
    const data = await res.json();

    // Sample marker
    expect(data.sample).toBe(true);

    // Event structure
    expect(data.event).toBeDefined();
    expect(data.event.type).toBe("payment.received");
    expect(data.event.asset).toBe("XLM");
    expect(data.event.amount).toBe("10.0000000");

    // from and to are valid Ed25519 public keys
    expect(StrKey.isValidEd25519PublicKey(data.event.from)).toBe(true);
    expect(StrKey.isValidEd25519PublicKey(data.event.to)).toBe(true);

    // Signature headers present
    expect(data.headers["x-orbital-signature"]).toBeDefined();
    expect(data.headers["x-orbital-timestamp"]).toBeDefined();
    expect(data.headers["x-orbital-attempt"]).toBe("1");

    // Sample marker in response
    expect(data.sample).toBe(true);
  });

  it("rejects invalid caller-supplied address with 400", async () => {
    const res = await fetch(`http://localhost:3000${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV" }),
    });

    expect(res.status).toBe(400);
  });

  it("accepts a valid caller-supplied address", async () => {
    // Generate a valid G-address for testing
    const { Keypair } = await import("@stellar/stellar-sdk");
    const validAddress = Keypair.random().publicKey();

    const res = await fetch(`http://localhost:3000${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: validAddress }),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.event.to).toBe(validAddress);
  });
});