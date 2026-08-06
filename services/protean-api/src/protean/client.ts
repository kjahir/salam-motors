// Protean e-Sign Pro client, written against the vendor guide v1.8.
//
// Every endpoint is POST, every request body carries the login credentials, and every
// request carries the `apikey` and `Authorization: Bearer` headers (guide §3). There is no
// request signing — see signing.ts for what happened to the scheme this file used to use.
//
// Only the operations this app needs are here. The guide also covers templates, bulk
// eSign, eMandate, digital-stamp inventory management and the eSign verifier; none of them
// are part of selling a vehicle, and an unused wrapper is a liability rather than an asset.

import { loadProteanConfig, type ProteanConfig, proteanConfigStatus } from "./config.ts";
import { ProteanHttpError } from "./http.ts";
import type {
  ArticleCodeResponse,
  ConsiderationPriceResponse,
  DocumentPdfResponse,
  DocumentStatusResponse,
  MasterESignRequest,
  MasterESignResponse,
  StampStatesResponse,
} from "./types.ts";

/** Verified endpoint paths (guide §4.3, §5.x). */
const ENDPOINTS = {
  masterESign: "/api/v1/masteresign",
  documentStatus: "/api/v1/esign/document-status",
  documentPdf: "/api/v1/esign/document-pdf",
  redirectUrl: "/api/v1/esign/RedirectUrl",
  cancelDocument: "/api/v1/esign/document/cancel",
  stampStates: "/api/v1/esign/stampstates",
  articleCodesEStamp: "/api/v1/esign/ArticleCodeFetchEstamp",
  considerationPrice: "/api/v1/esign/eStamp/considerationPrice",
  wallet: "/api/v1/esign/wallet",
  pincode: "/api/v1/esign/pincode",
} as const;

function requireConfigured(config: ProteanConfig): void {
  const status = proteanConfigStatus(config);
  if (!status.configured) {
    throw new ProteanHttpError(
      503,
      "PROTEAN_NOT_CONFIGURED",
      `Protean is not connected yet (missing: ${status.missing.join(", ")}). ` +
        "Set these secrets on this Supabase project before using this feature.",
    );
  }
}

/**
 * The vendor returns 200 with a body-level `status` on failures as well as successes, so
 * "did it work" is two questions: did the transport succeed, and did the payload report
 * success. Both are answered here so callers only ever see typed data or a thrown error.
 */
async function proteanPost<TResponse>(
  config: ProteanConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  requireConfigured(config);

  const payload = {
    // Guide §3: RiSE URLs want the operator's login in the body of every request.
    emailOrMobile: config.loginId,
    password: config.loginPassword,
    ...body,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "apikey": config.apiKey,
        "Authorization": `Bearer ${config.bearerToken}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // Read as text first: an auth rejection often comes back as an HTML error page or a
    // JSON body using some other field name for the reason, and `.json()` alone would
    // discard both — leaving a 401 with nothing to act on.
    const rawBody = await response.text();
    const parsed = parseJson(rawBody);
    if (!response.ok) throw transportError(response.status, parsed, rawBody, path);

    const bodyStatus = typeof parsed.status === "number" ? parsed.status : 200;
    if (bodyStatus >= 400) {
      const message = upstreamMessage(parsed) ?? "Protean rejected this request.";
      const code = typeof parsed.code === "string" ? parsed.code : `PROTEAN_${bodyStatus}`;
      console.error("Protean rejected request", path, code, message);
      throw new ProteanHttpError(502, `PROTEAN_${code}`, message, bodyStatus >= 500);
    }
    return parsed as TResponse;
  } catch (error) {
    if (error instanceof ProteanHttpError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ProteanHttpError(504, "PROTEAN_TIMEOUT", "Protean did not respond in time.", true);
    }
    console.error("Protean request errored", path, error);
    throw new ProteanHttpError(
      502,
      "PROTEAN_UNREACHABLE",
      "Could not reach Protean. Check that PROTEAN_API_BASE_URL points at a real host.",
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

/**
 * The vendor's own words for what went wrong.
 *
 * `message` is what the guide documents, but rejections at the gateway — before the eSign
 * application sees the request at all — arrive with other shapes. Each of these has been
 * seen from one API tier or another, so all are checked before falling back to the body.
 */
function upstreamMessage(payload: Record<string, unknown>): string | null {
  for (const key of ["message", "error_description", "errorMessage", "error", "msg", "description"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    // Some tiers nest it one level down: { error: { message } }.
    if (typeof value === "object" && value !== null) {
      const nested = (value as Record<string, unknown>).message;
      if (typeof nested === "string" && nested.trim()) return nested.trim();
    }
  }
  return null;
}

/** A readable fragment of a non-JSON body — usually an HTML error page's title. */
function bodyExcerpt(raw: string): string | null {
  const text = raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 200) : null;
}

function transportError(
  status: number,
  payload: Record<string, unknown>,
  rawBody: string,
  path: string,
): ProteanHttpError {
  const message = upstreamMessage(payload);
  const code = typeof payload.code === "string" ? payload.code : `HTTP_${status}`;
  console.error("Protean API request failed", path, status, code, message ?? rawBody.slice(0, 500));
  if (status === 401 || status === 403) {
    // Carry whatever they said into the message. Which credential failed is not something
    // we can work out from here — the headers authenticate the application and the body
    // credentials authenticate the user — so their wording is the only real evidence.
    const detail = message ?? bodyExcerpt(rawBody);
    return new ProteanHttpError(
      502,
      "PROTEAN_AUTH_FAILED",
      `Protean rejected the credentials (HTTP ${status}${detail ? `: ${detail}` : ", no reason given"}). ` +
        "Check PROTEAN_API_KEY, PROTEAN_BEARER_TOKEN, and the login id/password.",
    );
  }
  if (status === 429) {
    return new ProteanHttpError(429, "PROTEAN_RATE_LIMITED", "Protean is rate-limiting this account. Please retry shortly.", true);
  }
  return new ProteanHttpError(
    502,
    `PROTEAN_${code}`,
    message ?? bodyExcerpt(rawBody) ?? "Protean rejected this request.",
    status >= 500,
  );
}

export class ProteanClient {
  private readonly config: ProteanConfig;

  constructor(config: ProteanConfig = loadProteanConfig()) {
    this.config = config;
  }

  get organizationRegType(): string {
    return this.config.organizationRegType;
  }

  /** One call: document, optional eStamp, and every signer (guide §4.3). */
  async masterESign(request: MasterESignRequest): Promise<MasterESignResponse> {
    return await proteanPost<MasterESignResponse>(
      this.config,
      ENDPOINTS.masterESign,
      request as unknown as Record<string, unknown>,
    );
  }

  async documentStatus(documentId: string): Promise<DocumentStatusResponse> {
    return await proteanPost<DocumentStatusResponse>(this.config, ENDPOINTS.documentStatus, {
      documentId,
    });
  }

  /** The signed PDF, as a `data:application/pdf;base64,…` string (guide §5.20). */
  async documentPdf(documentId: string): Promise<DocumentPdfResponse> {
    return await proteanPost<DocumentPdfResponse>(this.config, ENDPOINTS.documentPdf, {
      documentId,
    });
  }

  /** Re-issues a signing link for one recipient (guide §5.7). */
  async signingUrl(params: {
    documentId: string;
    recipientId?: string;
    emailId?: string;
    mobileNo?: string;
  }): Promise<Record<string, unknown>> {
    return await proteanPost(this.config, ENDPOINTS.redirectUrl, { ...params });
  }

  async cancelDocument(documentId: string, feedback: string): Promise<Record<string, unknown>> {
    return await proteanPost(this.config, ENDPOINTS.cancelDocument, { documentId, feedback });
  }

  async stampStates(): Promise<StampStatesResponse> {
    return await proteanPost<StampStatesResponse>(this.config, ENDPOINTS.stampStates, {});
  }

  async articleCodesForEStamp(stateId: number): Promise<ArticleCodeResponse> {
    return await proteanPost<ArticleCodeResponse>(this.config, ENDPOINTS.articleCodesEStamp, {
      stateCode: String(stateId),
    });
  }

  /** Special states price their stamp duty by consideration value (guide §5.3). */
  async considerationPrice(params: {
    stateId: number;
    considerationPrice: number;
    articleCode: string;
  }): Promise<ConsiderationPriceResponse> {
    return await proteanPost<ConsiderationPriceResponse>(
      this.config,
      ENDPOINTS.considerationPrice,
      {
        stateId: String(params.stateId),
        considerationPrice: String(params.considerationPrice),
        articleCode: params.articleCode,
      },
    );
  }

  async wallet(): Promise<Record<string, unknown>> {
    return await proteanPost(this.config, ENDPOINTS.wallet, {});
  }
}
