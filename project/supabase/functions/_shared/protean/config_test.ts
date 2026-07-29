import { proteanConfigStatus, usableWebhookSecret, type ProteanConfig } from "./config.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function baseConfig(overrides: Partial<ProteanConfig> = {}): ProteanConfig {
  return {
    apiBaseUrl: "https://sandbox.example",
    clientId: "client-1",
    apiKey: "key-1",
    apiSecret: "secret-1",
    aspId: "asp-1",
    webhookSecret: "webhook-secret-1234",
    env: "sandbox",
    timeoutMs: 20_000,
    ...overrides,
  };
}

Deno.test("proteanConfigStatus reports configured=true when all required fields are present", () => {
  const status = proteanConfigStatus(baseConfig());
  assert(status.configured === true, "expected configured");
  assert(status.missing.length === 0, "expected no missing fields");
});

Deno.test("proteanConfigStatus reports each missing required field (placeholder secrets case)", () => {
  const status = proteanConfigStatus(
    baseConfig({ apiBaseUrl: "", clientId: "", apiKey: "", apiSecret: "", aspId: "" }),
  );
  assert(status.configured === false, "expected not configured");
  assert(status.missing.includes("apiBaseUrl"), "apiBaseUrl should be reported missing");
  assert(status.missing.includes("clientId"), "clientId should be reported missing");
  assert(status.missing.includes("apiKey"), "apiKey should be reported missing");
  assert(status.missing.includes("apiSecret"), "apiSecret should be reported missing");
  assert(status.missing.includes("aspId"), "aspId should be reported missing");
  assert(status.missing.length === 5, `expected exactly 5 missing fields, got ${status.missing.length}`);
});

Deno.test("proteanConfigStatus does not require webhookSecret (only relevant to webhook verification)", () => {
  const status = proteanConfigStatus(baseConfig({ webhookSecret: "" }));
  assert(status.configured === true, "webhookSecret should not gate API-call readiness");
});

Deno.test("usableWebhookSecret rejects blank and short secrets, accepts >=16 bytes", () => {
  assert(usableWebhookSecret(baseConfig({ webhookSecret: "" })) === null, "blank secret");
  assert(usableWebhookSecret(baseConfig({ webhookSecret: "short" })) === null, "too-short secret");
  const valid = "x".repeat(16);
  assert(usableWebhookSecret(baseConfig({ webhookSecret: valid })) === valid, "valid secret should be returned as-is");
});
