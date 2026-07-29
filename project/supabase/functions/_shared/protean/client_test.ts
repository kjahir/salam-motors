import { ProteanClient } from "./client.ts";
import { ProteanHttpError } from "./http.ts";
import type { ProteanConfig } from "./config.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function testConfig(overrides: Partial<ProteanConfig> = {}): ProteanConfig {
  return {
    apiBaseUrl: "https://sandbox.example",
    clientId: "client-1",
    apiKey: "key-1",
    apiSecret: "secret-1",
    aspId: "asp-1",
    webhookSecret: "webhook-secret-1234",
    env: "sandbox",
    timeoutMs: 5_000,
    ...overrides,
  };
}

async function withStubbedFetch(
  stub: typeof fetch,
  run: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

Deno.test("ProteanClient rejects calls when required credentials are blank (placeholder-secrets state)", async () => {
  // This is the exact state of the staging project today: PROTEAN_* secrets
  // exist but are placeholders. blank-string simulates "not yet filled in";
  // requireConfigured() should fail fast with no network call attempted.
  const client = new ProteanClient(testConfig({ apiSecret: "" }));
  let threw: unknown;
  try {
    await client.lookupVehicle("KA01AB1234");
  } catch (error) {
    threw = error;
  }
  assert(threw instanceof ProteanHttpError, "expected a ProteanHttpError");
  assert((threw as ProteanHttpError).code === "PROTEAN_NOT_CONFIGURED", "expected PROTEAN_NOT_CONFIGURED");
  assert((threw as ProteanHttpError).status === 503, "expected 503");
});

Deno.test("ProteanClient.lookupVehicle sends a signed POST and parses a successful response", async () => {
  let capturedUrl: string | undefined;
  let capturedInit: RequestInit | undefined;
  const stub: typeof fetch = (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return Promise.resolve(
      new Response(JSON.stringify({ registrationNumber: "KA01AB1234", makerModel: "Honda Activa" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };

  await withStubbedFetch(stub, async () => {
    const client = new ProteanClient(testConfig());
    const result = await client.lookupVehicle("KA01AB1234");
    assert(result.registrationNumber === "KA01AB1234", "expected parsed response body");
    assert(result.makerModel === "Honda Activa", "expected parsed response body");
  });

  assert(capturedUrl === "https://sandbox.example/vahan/v1/vehicle", `unexpected URL: ${capturedUrl}`);
  assert(capturedInit?.method === "POST", "expected POST");
  const headers = capturedInit?.headers as Record<string, string>;
  assert(headers["X-Protean-Client-Id"] === "client-1", "expected client id header");
  assert(headers["X-Protean-Signature"]?.length === 64, "expected a hex HMAC signature header");
  assert(headers["Authorization"] === "Bearer key-1", "expected bearer auth header");
});

Deno.test("ProteanClient maps a 401 upstream response to PROTEAN_AUTH_FAILED", async () => {
  const stub: typeof fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ errorCode: "INVALID_SIGNATURE", message: "bad signature" }), {
        status: 401,
      }),
    );

  await withStubbedFetch(stub, async () => {
    const client = new ProteanClient(testConfig());
    let threw: unknown;
    try {
      await client.lookupOwner("KA01AB1234");
    } catch (error) {
      threw = error;
    }
    assert(threw instanceof ProteanHttpError, "expected a ProteanHttpError");
    assert((threw as ProteanHttpError).code === "PROTEAN_AUTH_FAILED", "expected PROTEAN_AUTH_FAILED");
    assert((threw as ProteanHttpError).status === 502, "expected 502 (this service's own upstream-failure status)");
  });
});

Deno.test("ProteanClient maps a 429 upstream response to a retryable PROTEAN_RATE_LIMITED error", async () => {
  const stub: typeof fetch = () => Promise.resolve(new Response(JSON.stringify({}), { status: 429 }));

  await withStubbedFetch(stub, async () => {
    const client = new ProteanClient(testConfig());
    let threw: unknown;
    try {
      await client.lookupChallan("KA01AB1234");
    } catch (error) {
      threw = error;
    }
    assert(threw instanceof ProteanHttpError, "expected a ProteanHttpError");
    assert((threw as ProteanHttpError).code === "PROTEAN_RATE_LIMITED", "expected PROTEAN_RATE_LIMITED");
    assert((threw as ProteanHttpError).retryable === true, "expected retryable=true");
  });
});

Deno.test("ProteanClient.initiateESign posts to the esign endpoint with the request body", async () => {
  let capturedBody: string | undefined;
  let capturedUrl: string | undefined;
  const stub: typeof fetch = (input, init) => {
    capturedUrl = String(input);
    capturedBody = init?.body as string;
    return Promise.resolve(
      new Response(JSON.stringify({ referenceId: "ref-1", signUrl: "https://sign.example/x", status: "initiated" }), {
        status: 200,
      }),
    );
  };

  await withStubbedFetch(stub, async () => {
    const client = new ProteanClient(testConfig());
    const result = await client.initiateESign({
      referenceId: "our-row-1",
      documentLabel: "Sale Agreement",
      signers: [{ name: "Test Buyer", mobile: "+919999999999" }],
    });
    assert(result.referenceId === "ref-1", "expected parsed referenceId");
    assert(result.signUrl === "https://sign.example/x", "expected parsed signUrl");
  });

  assert(capturedUrl === "https://sandbox.example/esign/v2/initiate", `unexpected URL: ${capturedUrl}`);
  const parsedBody = JSON.parse(capturedBody ?? "{}");
  assert(parsedBody.referenceId === "our-row-1", "expected request body to be forwarded");
  assert(parsedBody.signers[0].name === "Test Buyer", "expected signers array forwarded");
});

Deno.test("ProteanClient.getESignStatus issues a GET to the status endpoint with the reference id in the path", async () => {
  let capturedUrl: string | undefined;
  let capturedMethod: string | undefined;
  const stub: typeof fetch = (input, init) => {
    capturedUrl = String(input);
    capturedMethod = init?.method;
    return Promise.resolve(new Response(JSON.stringify({ referenceId: "ref-1", status: "completed" }), { status: 200 }));
  };

  await withStubbedFetch(stub, async () => {
    const client = new ProteanClient(testConfig());
    const result = await client.getESignStatus("ref-1");
    assert(result.status === "completed", "expected parsed status");
  });

  assert(capturedUrl === "https://sandbox.example/esign/v2/status/ref-1", `unexpected URL: ${capturedUrl}`);
  assert(capturedMethod === "GET", "expected GET");
});

Deno.test("ProteanClient maps a fetch-level timeout to PROTEAN_TIMEOUT", async () => {
  const stub: typeof fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    });

  await withStubbedFetch(stub, async () => {
    const client = new ProteanClient(testConfig({ timeoutMs: 10 }));
    let threw: unknown;
    try {
      await client.lookupInsurance("KA01AB1234");
    } catch (error) {
      threw = error;
    }
    assert(threw instanceof ProteanHttpError, "expected a ProteanHttpError");
    assert((threw as ProteanHttpError).code === "PROTEAN_TIMEOUT", "expected PROTEAN_TIMEOUT");
    assert((threw as ProteanHttpError).retryable === true, "expected retryable=true");
  });
});
