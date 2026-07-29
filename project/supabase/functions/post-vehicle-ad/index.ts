// Posts (or, until real credentials exist, simulates posting) a
// vehicle listing as a Google Business Profile ad - free product
// listings, NOT paid Google Ads.
//
// Posting model (locked in with the user):
//   1. A single VahanExchange-owned Google Business Profile account
//      posts every actively-listed vehicle across every dealer.
//   2. If the listing dealer has also filled in their own
//      google_business_handle (Company tab), the vehicle is additionally
//      cross-posted to the dealer's own account.
//
// This function is called two ways:
//   - Automatically: the frontend fires this right after a listing is
//     published (Passport.tsx togglePublish, Active), best-effort/
//     fire-and-forget, matching the existing syncVehicleAlerts() pattern.
//   - Manually: same endpoint, callable again to retry a failed/skipped
//     post once real credentials exist, or after a dealer adds a handle.
// Either way it is idempotent per (vehicle_id, platform) - it upserts
// vehicle_ad_posts rather than creating duplicate rows.
//
// A `trg_queue_vehicle_ad_posts` DB trigger (20260729150000 migration)
// independently queues rows the moment a listing becomes Active, so a
// queued-but-never-processed row is always visible even if this function
// is never actually invoked (client tab closed, network blip, etc.) -
// this function is what turns "queued" into "posted"/"failed"/"skipped".
//
// Auth model mirrors invite-team-member: a caller-scoped client (the
// requester's own JWT, RLS applies) is used purely to authorize the
// request - confirm the caller has one of the write roles vehicle_ad_posts
// RLS already requires (owner/manager/sales_executive) on the vehicle's
// org, and that the vehicle/listing actually exist in that org. Every
// read/write after that point uses the service-role client, since a
// storage signed URL and a cross-account write don't fit cleanly inside
// what RLS alone can express for a single request.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildAdCreative } from "../_shared/google-business/creative.ts";
import { loadGoogleBusinessProfileConfig } from "../_shared/google-business/config.ts";
import { postToSharedAccount } from "../_shared/google-business/post.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const WRITE_ROLES = ["owner", "manager", "sales_executive"];
const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days - placeholder; a real
// integration would need either a public bucket/CDN URL or to upload photo
// bytes directly to Google's media endpoint, since Local Posts wants a
// durably-fetchable sourceUrl, not a short-lived signed link.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData.user) {
    return json({ error: "Invalid session" }, 401);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof (body as Record<string, unknown>).vehicle_id !== "string") {
    return json({ error: "vehicle_id is required" }, 400);
  }
  const vehicleId = (body as { vehicle_id: string }).vehicle_id;

  // RLS-scoped: only ever sees the vehicle if the caller is an active
  // member of its org (any role - matches the vehicles SELECT policy).
  const { data: vehicle, error: vehicleErr } = await callerClient
    .from("vehicles")
    .select(
      "id, org_id, manufacturer, brand, model, variant, manufacture_year, asking_price, fuel_type, odometer, registration_state, current_status",
    )
    .eq("id", vehicleId)
    .is("deleted_at", null)
    .maybeSingle();
  if (vehicleErr || !vehicle) {
    return json({ error: "Vehicle not found" }, 404);
  }

  const { data: callerMembership } = await callerClient
    .from("memberships")
    .select("role, status")
    .eq("org_id", vehicle.org_id)
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!callerMembership || !WRITE_ROLES.includes(callerMembership.role)) {
    return json({ error: "Role cannot post vehicle ads" }, 403);
  }

  const { data: listing, error: listingErr } = await callerClient
    .from("listings")
    .select("id, status")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();
  if (listingErr || !listing || listing.status !== "Active") {
    return json({ error: "Vehicle is not actively listed; nothing to post" }, 409);
  }

  // From here on, use the service role - a storage signed URL and writing
  // vehicle_ad_posts for both platforms in one pass don't map cleanly onto
  // a single caller-scoped RLS statement.
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: settings } = await admin
    .from("app_settings")
    .select("google_business_handle")
    .eq("org_id", vehicle.org_id)
    .maybeSingle();
  const dealerHandle = settings?.google_business_handle ?? null;

  const { data: media } = await admin
    .from("vehicle_media")
    .select("file_url")
    .eq("vehicle_id", vehicleId)
    .eq("media_type", "photo")
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: true })
    .limit(1);
  const coverPhotoPath = media?.[0]?.file_url ?? null;

  let photoUrl: string | null = null;
  if (coverPhotoPath) {
    const { data: signed } = await admin.storage
      .from("vehicle-photos")
      .createSignedUrl(coverPhotoPath, PHOTO_SIGNED_URL_TTL_SECONDS);
    photoUrl = signed?.signedUrl ?? null;
  }

  const creative = buildAdCreative({
    manufacturer: vehicle.manufacturer,
    brand: vehicle.brand,
    model: vehicle.model,
    variant: vehicle.variant,
    manufacture_year: vehicle.manufacture_year,
    asking_price: vehicle.asking_price,
    fuel_type: vehicle.fuel_type,
    odometer: vehicle.odometer,
    registration_state: vehicle.registration_state,
    photo_url: photoUrl,
  });

  const results: Array<{
    platform: string;
    status: "posted" | "failed" | "skipped";
    external_post_id: string | null;
    error_message: string | null;
  }> = [];

  // Shared VahanExchange-owned account - always attempted.
  const config = loadGoogleBusinessProfileConfig();
  const sharedResult = await postToSharedAccount(config, creative);
  if (sharedResult.ok) {
    results.push({
      platform: "google_business_shared",
      status: "posted",
      external_post_id: sharedResult.externalPostId,
      error_message: null,
    });
  } else if (sharedResult.reason === "not_configured") {
    results.push({
      platform: "google_business_shared",
      status: "skipped",
      external_post_id: null,
      error_message: "Google Business Profile credentials are not configured yet (GOOGLE_BUSINESS_PROFILE_* secrets are placeholders on this environment).",
    });
  } else {
    results.push({
      platform: "google_business_shared",
      status: "failed",
      external_post_id: null,
      error_message: sharedResult.error,
    });
  }

  // Dealer's own account - only attempted (as a queue entry) when they've
  // set a handle. Always 'skipped' today: a handle alone is not an API
  // credential, and there is no dealer-side OAuth-connect flow yet to
  // obtain one. This is a known, intentional gap - see post.ts header.
  if (dealerHandle) {
    results.push({
      platform: "google_business_dealer",
      status: "skipped",
      external_post_id: null,
      error_message: `Dealer cross-posting to @${dealerHandle} requires a dealer-authorized Google Business Profile connection, which is not built yet. The handle has been recorded but cannot be posted to automatically.`,
    });
  }

  const now = new Date().toISOString();
  for (const result of results) {
    const { error: upsertErr } = await admin
      .from("vehicle_ad_posts")
      .upsert(
        {
          org_id: vehicle.org_id,
          vehicle_id: vehicleId,
          listing_id: listing.id,
          platform: result.platform,
          status: result.status,
          creative,
          external_post_id: result.external_post_id,
          error_message: result.error_message,
          posted_at: result.status === "posted" ? now : null,
          updated_at: now,
        },
        { onConflict: "vehicle_id,platform" },
      );
    if (upsertErr) {
      console.error("post-vehicle-ad: failed to record result", result.platform, upsertErr);
    }
  }

  return json({ ok: true, vehicle_id: vehicleId, results });
});
