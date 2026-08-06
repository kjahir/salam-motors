import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  from: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    from: mocks.from,
  },
}));

import {
  agreementPath,
  canCancel,
  canRefresh,
  isSettled,
  prepareSaleAgreement,
  sendSaleAgreementForSignature,
  type ProteanDocumentRequest,
} from "./esign";
import { ProteanApiError } from "./proteanApi";

const SERVICE_URL = "https://protean-api.internal.example";

function request(overrides: Partial<ProteanDocumentRequest> = {}): ProteanDocumentRequest {
  return {
    id: "request-1",
    org_id: "org-1",
    vehicle_id: "vehicle-1",
    sale_id: "sale-1",
    request_type: "esign",
    status: "pending",
    document_label: "Sale agreement KA01AB1234",
    signer_details: null,
    request_payload: { document_path: "org-1/vehicle-1/sale-agreements/ref.pdf" },
    protean_reference_id: "doc-1",
    document_url: null,
    stamp_duty_amount: null,
    error_code: null,
    error_message: null,
    initiated_at: "2026-08-04T09:00:00.000Z",
    completed_at: null,
    updated_at: "2026-08-04T09:00:00.000Z",
    ...overrides,
  };
}

/** The last request the client made, so assertions can read the URL, headers and body. */
function lastCall(): { url: string; init: RequestInit; body: Record<string, unknown> } {
  const calls = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
  const [url, init] = calls[calls.length - 1] as [string, RequestInit];
  return { url, init, body: JSON.parse(String(init.body)) };
}

function respondWith(body: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
}

describe("sale signing requests", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_PROTEAN_API_URL", SERVICE_URL);
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "signed-user-jwt" } },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("calls the Protean service with the caller's Supabase token", async () => {
    respondWith({
      document: { path: "p", documentId: "d", label: "l", vehicleId: "v" },
      signers: [],
      parties: { first: "a", second: "b" },
    });

    await prepareSaleAgreement("org-1", "sale-1", [{ name: "R. Kumar", mobile: "9876543210" }]);

    const { url, init, body } = lastCall();
    // The service lives outside Supabase because Protean whitelists the calling IP; the
    // caller is still identified by their Supabase session.
    expect(url).toBe(`${SERVICE_URL}/esign`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer signed-user-jwt");
    expect(body).toEqual({
      action: "prepare_sale_agreement",
      org_id: "org-1",
      sale_id: "sale-1",
      signers: [{ name: "R. Kumar", mobile: "9876543210" }],
    });
  });

  it("trims a trailing slash off the configured service URL", async () => {
    vi.stubEnv("VITE_PROTEAN_API_URL", `${SERVICE_URL}/`);
    respondWith({ request: request() });
    await sendSaleAgreementForSignature("org-1", "sale-1", [{ name: "R. Kumar" }]);
    expect(lastCall().url).toBe(`${SERVICE_URL}/esign`);
  });

  it("sends the signer back to the page they started from", async () => {
    respondWith({ request: request() });
    await sendSaleAgreementForSignature("org-1", "sale-1", [{ name: "R. Kumar" }]);
    const { body } = lastCall();
    expect(body.action).toBe("initiate_esign");
    expect(body.redirect_url).toBe(window.location.href);
  });

  it("sends the stamp as part of the signature request, not as its own call", async () => {
    // Protean's single API takes the document, the stamp and the signers together; a
    // separate stamping call would create a second unrelated document.
    respondWith({ request: request() });

    await sendSaleAgreementForSignature(
      "org-1",
      "sale-1",
      [{ name: "R. Kumar", dob: "1990-05-02", pan: "ABCPK1234C" }],
      {
        stateId: 29,
        articleCode: "5 - General Agreement (1003)",
        stampAmount: 500,
        paidBy: "firstParty",
      },
    );

    const { body } = lastCall();
    expect(body.stamp).toEqual({
      state_id: 29,
      article_code: "5 - General Agreement (1003)",
      stamp_amount: 500,
      paid_by: "firstParty",
    });
    expect((body.signers as { dob: string }[])[0].dob).toBe("1990-05-02");
  });

  it("omits the stamp entirely when none was asked for", async () => {
    respondWith({ request: request() });
    await sendSaleAgreementForSignature("org-1", "sale-1", [{ name: "R. Kumar" }], null);
    expect(lastCall().body.stamp).toBeUndefined();
  });

  it("surfaces the service's own code and message on failure", async () => {
    // The useful failures are all specific — which secret is missing, which field Protean
    // rejected — and a generic "request failed" would throw all of that away.
    respondWith(
      {
        error: {
          code: "PROTEAN_NOT_CONFIGURED",
          message: "Protean is not connected yet (missing: PROTEAN_BEARER_TOKEN).",
        },
      },
      503,
    );

    const failure = await prepareSaleAgreement("org-1", "sale-1").then(
      () => new Error("the call should not have succeeded"),
      (e: unknown) => e as ProteanApiError,
    );

    expect(failure).toBeInstanceOf(ProteanApiError);
    expect(failure.message).toContain("PROTEAN_BEARER_TOKEN");
    expect((failure as ProteanApiError).code).toBe("PROTEAN_NOT_CONFIGURED");
  });

  it("reports an unreachable service differently from a Protean failure", async () => {
    // A network-level failure means CORS or the VPC, not Protean being down.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const failure = await prepareSaleAgreement("org-1", "sale-1").then(
      () => new Error("the call should not have succeeded"),
      (e: unknown) => e as ProteanApiError,
    );

    expect((failure as ProteanApiError).code).toBe("SERVICE_UNREACHABLE");
  });

  it("refuses to call the service without a session", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    vi.stubGlobal("fetch", vi.fn());

    const failure = await prepareSaleAgreement("org-1", "sale-1").then(
      () => new Error("the call should not have succeeded"),
      (e: unknown) => e as ProteanApiError,
    );

    expect((failure as ProteanApiError).code).toBe("AUTH_REQUIRED");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("says so when the build has no service URL configured", async () => {
    vi.stubEnv("VITE_PROTEAN_API_URL", "");
    vi.stubGlobal("fetch", vi.fn());

    const failure = await prepareSaleAgreement("org-1", "sale-1").then(
      () => new Error("the call should not have succeeded"),
      (e: unknown) => e as Error,
    );

    expect(failure.message).toContain("VITE_PROTEAN_API_URL");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("only offers status checks and cancellation while the outcome can change", () => {
    expect(canRefresh(request({ status: "pending" }))).toBe(true);
    expect(canCancel(request({ status: "pending" }))).toBe(true);
    expect(canRefresh(request({ status: "completed" }))).toBe(false);
    expect(canCancel(request({ status: "cancelled" }))).toBe(false);
    // A request that never reached Protean has no documentId to poll with.
    expect(canRefresh(request({ protean_reference_id: null }))).toBe(false);
  });

  it("knows which states are final", () => {
    expect(isSettled("completed")).toBe(true);
    expect(isSettled("expired")).toBe(true);
    expect(isSettled("initiated")).toBe(false);
    expect(isSettled("pending")).toBe(false);
  });

  it("finds the stored agreement behind a request, when there is one", () => {
    expect(agreementPath(request())).toBe("org-1/vehicle-1/sale-agreements/ref.pdf");
    expect(agreementPath(request({ request_payload: {} }))).toBeNull();
    expect(agreementPath(request({ request_payload: null }))).toBeNull();
  });
});
