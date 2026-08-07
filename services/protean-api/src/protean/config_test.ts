import {
  loadProteanConfig,
  PROTEAN_HOSTS,
  proteanConfigStatus,
  usableWebhookSecret,
  type ProteanConfig,
} from "./config.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function baseConfig(overrides: Partial<ProteanConfig> = {}): ProteanConfig {
  return {
    apiBaseUrl: PROTEAN_HOSTS.sandbox,
    apiKey: "key-1",
    bearerToken: "token-1",
    loginId: "dealer@example.com",
    loginPassword: "secret",
    webhookSecret: "webhook-secret-1234",
    organizationRegType: "NonLoan-Individual",
    env: "sandbox",
    timeoutMs: 30_000,
    ...overrides,
  };
}

Deno.test("a fully populated config is reported as connected", () => {
  const status = proteanConfigStatus(baseConfig());
  assert(status.configured === true, "expected configured");
  assert(status.missing.length === 0, "expected no missing fields");
});

Deno.test("missing credentials are named by their secret, not their field", () => {
  // The list goes into a user-facing message whose whole job is to say which secret to go
  // and set, so "PROTEAN_BEARER_TOKEN" is the useful string, not "bearerToken".
  const status = proteanConfigStatus(
    baseConfig({ apiKey: "", bearerToken: "", loginId: "", loginPassword: "" }),
  );
  assert(status.configured === false, "expected not configured");
  for (const secret of [
    "PROTEAN_API_KEY",
    "PROTEAN_BEARER_TOKEN",
    "PROTEAN_LOGIN_ID",
    "PROTEAN_LOGIN_PASSWORD",
  ]) {
    assert(status.missing.includes(secret), `${secret} should be reported missing`);
  }
  assert(status.missing.length === 4, `expected 4 missing, got ${status.missing.length}`);
});

Deno.test("the webhook secret does not gate outbound calls", () => {
  const status = proteanConfigStatus(baseConfig({ webhookSecret: "" }));
  assert(status.configured === true, "webhookSecret only matters for inbound callbacks");
});

Deno.test("usableWebhookSecret rejects blank and short secrets, accepts >=16 bytes", () => {
  assert(usableWebhookSecret(baseConfig({ webhookSecret: "" })) === null, "blank secret");
  assert(usableWebhookSecret(baseConfig({ webhookSecret: "short" })) === null, "too-short secret");
  const valid = "x".repeat(16);
  assert(usableWebhookSecret(baseConfig({ webhookSecret: valid })) === valid, "valid secret");
});

Deno.test("the published hosts are the ones from the vendor guide", () => {
  assert(PROTEAN_HOSTS.sandbox === "https://uat.risewithprotean.io", PROTEAN_HOSTS.sandbox);
  assert(PROTEAN_HOSTS.production === "https://api.risewithprotean.io", PROTEAN_HOSTS.production);
});

Deno.test("a bearer token pasted with its scheme word still works", () => {
  // The guide shows the whole header value, so copying "Bearer aLojj…" into the secret is
  // the natural mistake; left alone it would send "Bearer Bearer aLojj…" and 401.
  const cases: [string, string][] = [
    ["aLojjYtDu5dAFwgDoRHTEhYHUUNR", "aLojjYtDu5dAFwgDoRHTEhYHUUNR"],
    ["Bearer aLojjYtDu5dAFwgDoRHTEhYHUUNR", "aLojjYtDu5dAFwgDoRHTEhYHUUNR"],
    ["bearer  aLojjYtDu5dAFwgDoRHTEhYHUUNR ", "aLojjYtDu5dAFwgDoRHTEhYHUUNR"],
  ];
  for (const [stored, expected] of cases) {
    Deno.env.set("PROTEAN_BEARER_TOKEN", stored);
    const config = loadProteanConfig();
    assert(config.bearerToken === expected, `${stored} -> ${config.bearerToken}`);
  }
  Deno.env.delete("PROTEAN_BEARER_TOKEN");
});

Deno.test("the base URL defaults to the host matching the environment", () => {
  Deno.env.delete("PROTEAN_API_BASE_URL");
  Deno.env.set("PROTEAN_ENV", "production");
  assert(loadProteanConfig().apiBaseUrl === PROTEAN_HOSTS.production, "production host");
  Deno.env.set("PROTEAN_ENV", "sandbox");
  assert(loadProteanConfig().apiBaseUrl === PROTEAN_HOSTS.sandbox, "sandbox host");
  // An explicit base URL wins, with any trailing slash trimmed so paths do not double up.
  Deno.env.set("PROTEAN_API_BASE_URL", "https://uat.risewithprotean.io/");
  assert(loadProteanConfig().apiBaseUrl === "https://uat.risewithprotean.io", "trailing slash");
  Deno.env.delete("PROTEAN_API_BASE_URL");
  Deno.env.delete("PROTEAN_ENV");
});
