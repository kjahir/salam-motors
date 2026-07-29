// Actually posting to Google Business Profile's Local Posts API
// (https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts).
// This is real request-shaped code, but with no live credentials
// provisioned yet (see config.ts), postToSharedAccount() always
// short-circuits to `{ ok: false, reason: "not_configured" }` before ever
// making a network call - it becomes a real post the moment
// GOOGLE_BUSINESS_PROFILE_* secrets are filled in, no code change needed.
//
// There is deliberately no equivalent "post to dealer account" function
// here: doing that for real would need a per-dealer OAuth grant (the
// dealer authorizing VahanExchange to post to *their* Google Business
// Profile), which does not exist yet. Collecting `google_business_handle`
// only records intent to cross-post; it is not, by itself, an API
// credential. See post-vehicle-ad/index.ts for how that gap is surfaced.

import type { AdCreative } from "./creative.ts";
import { type GoogleBusinessProfileConfig, isConfigured } from "./config.ts";

export type PostResult =
  | { ok: true; externalPostId: string }
  | { ok: false; reason: "not_configured" }
  | { ok: false; reason: "api_error"; error: string };

export async function postToSharedAccount(
  config: GoogleBusinessProfileConfig,
  creative: AdCreative,
): Promise<PostResult> {
  if (!isConfigured(config)) {
    return { ok: false, reason: "not_configured" };
  }

  try {
    const response = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${config.accountId}/locations/${config.locationId}/localPosts`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          languageCode: "en",
          summary: creative.description,
          topicType: "STANDARD",
          ...(creative.photo_url
            ? { media: [{ mediaFormat: "PHOTO", sourceUrl: creative.photo_url }] }
            : {}),
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        reason: "api_error",
        error: `Google Business Profile API returned ${response.status}: ${body.slice(0, 300)}`,
      };
    }

    const body = await response.json().catch(() => ({}));
    const externalPostId = typeof body?.name === "string" ? body.name : `unknown-${Date.now()}`;
    return { ok: true, externalPostId };
  } catch (error) {
    return {
      ok: false,
      reason: "api_error",
      error: error instanceof Error ? error.message : "Unknown network error",
    };
  }
}
