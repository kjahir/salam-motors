import { ProteanClient } from "./client.ts";
import { ProteanHttpError } from "./http.ts";
import { PROTEAN_HOSTS, type ProteanConfig } from "./config.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function testConfig(overrides: Partial<ProteanConfig> = {}): ProteanConfig {
  return {
    apiBaseUrl: PROTEAN_HOSTS.sandbox,
    apiKey: "key-1",
    bearerToken: "token-1",
    loginId: "dealer@example.com",
    loginPassword: "secret",
    webhookSecret: "webhook-secret-1234",
    organizationRegType: "NonLoan-Individual",
    env: "sandbox",
    timeoutMs: 5_000,
    ...overrides,
  };
}

async function withStubbedFetch(stub: typeof fetch, run: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const MINIMAL_REQUEST = {
  documentName: "Sale Agreement",
  documentType: "Purchase Agreement" as const,
  pdfFiles: ["data:application/pdf;base64,JVBERi0="],
  isSequentialSign: true,
  recipientData: [{ firstName: "Kumar", selectedSignType: "Aadhaar" as const, signOrder: 1 }],
};

Deno.test("calls are refused before the network when credentials are blank", async () => {
  // The staging state today: PROTEAN_* secrets exist but hold placeholder values.
  const client = new ProteanClient(testConfig({ bearerToken: "" }));
  const error = await client.masterESign(MINIMAL_REQUEST).catch((thrown) => thrown);
  assert(error instanceof ProteanHttpError, "expected a ProteanHttpError");
  assert(error.code === "PROTEAN_NOT_CONFIGURED", error.code);
  assert(error.status === 503, `expected 503, got ${error.status}`);
  assert(error.message.includes("PROTEAN_BEARER_TOKEN"), "the message should name the secret");
});

Deno.test("masterESign posts to the documented path with the documented auth", async () => {
  let url: string | undefined;
  let init: RequestInit | undefined;
  const stub: typeof fetch = (input, requestInit) => {
    url = String(input);
    init = requestInit;
    return Promise.resolve(jsonResponse({
      status: 200,
      message: "Document has been successfully sent to the Recipients for eSigning",
      code: "5052",
      data: {
        documentId: "doc-1",
        recipientData: [{ recipientId: "rec-1" }],
        redirectUrl: [{ recipientId: "rec-1", redirectUrl: "https://sign.example/x" }],
      },
    }));
  };

  await withStubbedFetch(stub, async () => {
    const response = await new ProteanClient(testConfig()).masterESign(MINIMAL_REQUEST);
    assert(response.data.documentId === "doc-1", "documentId not parsed");
    assert(response.code === "5052", "code not parsed");
  });

  assert(url === `${PROTEAN_HOSTS.sandbox}/api/v1/masteresign`, url ?? "no url");
  assert(init?.method === "POST", "must be POST");
  const headers = init?.headers as Record<string, string>;
  assert(headers.apikey === "key-1", "apikey header missing");
  assert(headers.Authorization === "Bearer token-1", "bearer token missing");

  // Guide §3: RiSE URLs want the operator login repeated in every request body.
  const body = JSON.parse(String(init?.body));
  assert(body.emailOrMobile === "dealer@example.com", "login id not in the body");
  assert(body.password === "secret", "password not in the body");
  assert(body.documentName === "Sale Agreement", "request fields were dropped");
  // Nothing is signed — the old HMAC headers must not reappear.
  assert(!("X-Protean-Signature" in headers), "a signature header was sent");
});

Deno.test("a failure reported inside a 200 body is still a failure", async () => {
  // The vendor returns transport-200 with a body-level status on rejections, so a client
  // that only checks response.ok would treat a refusal as success.
  const stub: typeof fetch = () =>
    Promise.resolve(jsonResponse({
      status: 422,
      message: "documentName must be alphanumeric",
      code: "4001",
    }));

  await withStubbedFetch(stub, async () => {
    const error = await new ProteanClient(testConfig())
      .masterESign(MINIMAL_REQUEST)
      .catch((thrown) => thrown);
    assert(error instanceof ProteanHttpError, "expected a ProteanHttpError");
    assert(error.message === "documentName must be alphanumeric", error.message);
    assert(error.code === "PROTEAN_4001", error.code);
  });
});

Deno.test("rejected credentials are reported as such, with what to check", async () => {
  const stub: typeof fetch = () => Promise.resolve(jsonResponse({ message: "Unauthorized" }, 401));
  await withStubbedFetch(stub, async () => {
    const error = await new ProteanClient(testConfig())
      .documentStatus("doc-1")
      .catch((thrown) => thrown);
    assert(error instanceof ProteanHttpError, "expected a ProteanHttpError");
    assert(error.code === "PROTEAN_AUTH_FAILED", error.code);
  });
});

Deno.test("an unreachable host says so rather than blaming Protean", async () => {
  // The placeholder base URL case: the failure is our configuration, not their uptime.
  const stub: typeof fetch = () => Promise.reject(new TypeError("error sending request"));
  await withStubbedFetch(stub, async () => {
    const error = await new ProteanClient(testConfig())
      .stampStates()
      .catch((thrown) => thrown);
    assert(error instanceof ProteanHttpError, "expected a ProteanHttpError");
    assert(error.code === "PROTEAN_UNREACHABLE", error.code);
    assert(error.message.includes("PROTEAN_API_BASE_URL"), "should point at the likely cause");
  });
});

Deno.test("article codes are fetched per state, as stateCode", async () => {
  let body: Record<string, unknown> = {};
  const stub: typeof fetch = (_input, init) => {
    body = JSON.parse(String(init?.body));
    return Promise.resolve(jsonResponse({ status: 200, data: { articleCode: ["5 - General Agreement (1003)"] } }));
  };
  await withStubbedFetch(stub, async () => {
    const response = await new ProteanClient(testConfig()).articleCodesForEStamp(29);
    assert(response.data.articleCode.length === 1, "article codes not parsed");
  });
  // The parameter is named stateCode and carries the numeric state id as a string.
  assert(body.stateCode === "29", JSON.stringify(body));
});

Deno.test("an auth rejection carries whatever reason Protean gave", async () => {
  // A 401 whose body uses a field name the guide never documents; the reason must still
  // reach the dealer, because which credential failed is not knowable from our side.
  const stub: typeof fetch = () =>
    Promise.resolve(jsonResponse({ error_description: "Access token expired" }, 401));
  await withStubbedFetch(stub, async () => {
    const error = await new ProteanClient(testConfig())
      .stampStates()
      .catch((thrown) => thrown);
    assert(error.code === "PROTEAN_AUTH_FAILED", error.code);
    assert(error.message.includes("Access token expired"), error.message);
    assert(error.message.includes("401"), "the status code should be visible");
  });
});

Deno.test("an HTML rejection page is reduced to readable text, not dropped", async () => {
  // Gateway-level rejections arrive as HTML. Parsing it as JSON yields nothing, which is
  // how a 401 ends up with no reason attached at all.
  const stub: typeof fetch = () =>
    Promise.resolve(
      new Response("<html><head><title>403 Forbidden</title></head><body><h1>Forbidden</h1></body></html>", {
        status: 403,
        headers: { "content-type": "text/html" },
      }),
    );
  await withStubbedFetch(stub, async () => {
    const error = await new ProteanClient(testConfig())
      .stampStates()
      .catch((thrown) => thrown);
    assert(error.code === "PROTEAN_AUTH_FAILED", error.code);
    assert(error.message.includes("403 Forbidden"), error.message);
    assert(!error.message.includes("<html>"), "markup should be stripped");
  });
});

Deno.test("a rejection with a genuinely empty body says so rather than inventing one", async () => {
  const stub: typeof fetch = () => Promise.resolve(new Response("", { status: 401 }));
  await withStubbedFetch(stub, async () => {
    const error = await new ProteanClient(testConfig())
      .stampStates()
      .catch((thrown) => thrown);
    assert(error.message.includes("no reason given"), error.message);
  });
});
