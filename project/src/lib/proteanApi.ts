import { supabase } from "./supabase";

/**
 * Transport for the Protean service.
 *
 * These calls used to go to Supabase Edge Functions via `functions.invoke`. Protean
 * whitelists the IP its callers arrive from, and edge functions egress from a shared pool
 * with no stable address, so the Protean-facing code now runs as its own service inside a
 * VPC behind a dedicated IP — `services/protean-api/`.
 *
 * What that changes here: the URL, and that the access token has to be attached by hand
 * rather than by the Supabase client. What it does not change: the caller is still
 * identified by their Supabase session, and the service still applies row-level security
 * to everything it reads on their behalf.
 */

function baseUrl(): string {
  const url = import.meta.env.VITE_PROTEAN_API_URL as string | undefined;
  if (!url) {
    throw new Error(
      "The signing service is not configured for this build (VITE_PROTEAN_API_URL).",
    );
  }
  return url.replace(/\/+$/, "");
}

/**
 * Errors carry the service's own code and message.
 *
 * Worth the small amount of plumbing: the useful failures here are all specific —
 * "not connected yet (missing: PROTEAN_BEARER_TOKEN)", "Protean rejected the credentials
 * (HTTP 401: …)", "documentName must be alphanumeric" — and a generic "request failed"
 * would throw away the only thing that tells a dealer what to do next.
 */
export class ProteanApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = code;
  }
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new ProteanApiError(
      "AUTH_REQUIRED",
      "Your session has expired. Please sign in again.",
      401,
    );
  }

  // Resolved before the try below: a missing VITE_PROTEAN_API_URL is a build
  // misconfiguration, and catching it alongside network failures would report it as the
  // service being unreachable — sending whoever debugs it to the wrong place entirely.
  const url = `${baseUrl()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // A network-level failure here means the service is unreachable from the browser —
    // usually a CORS rejection or the VPC not being exposed — which is a different
    // problem from Protean being down, and worth saying so.
    throw new ProteanApiError(
      "SERVICE_UNREACHABLE",
      "The signing service could not be reached.",
      503,
    );
  }

  const payload = await response.json().catch(() => null) as
    | { error?: { code?: string; message?: string } }
    | null;

  if (!response.ok || payload?.error) {
    const error = payload?.error;
    throw new ProteanApiError(
      error?.code ?? `HTTP_${response.status}`,
      error?.message ?? "The request could not be completed.",
      response.status,
    );
  }
  return payload as T;
}

export function proteanEsign<T>(body: Record<string, unknown>): Promise<T> {
  return post<T>("/esign", body);
}

export function proteanLookup<T>(body: Record<string, unknown>): Promise<T> {
  return post<T>("/lookup", body);
}
