// Invite a new staff member or link a partner to a self-service login.
//
// A bare `memberships` row grants no login on its own - creating the actual
// auth.users record (and, for staff, its membership row) needs
// `auth.admin.inviteUserByEmail`, which only works with the service role
// key. That key must never reach the browser, so this has to run as an
// Edge Function rather than a direct client insert.
//
// Never trust `org_id` from the request body alone: the caller's own
// membership is looked up (scoped by their own JWT, so RLS applies) and
// only an active `owner` on that exact org is allowed to invite.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // Scoped to the caller's own JWT - RLS applies, so this can only ever see
  // the caller's own membership row(s). Used purely to authorize the request.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData.user) {
    return json({ error: "Invalid session" }, 401);
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return json({ error: "Invalid request body" }, 400);
  }
  const { org_id, email, role, display_name, kind, partner_id } = body as {
    org_id?: string;
    email?: string;
    role?: string;
    display_name?: string;
    kind?: "staff" | "partner";
    partner_id?: string;
  };

  if (!org_id || !email) {
    return json({ error: "org_id and email are required" }, 400);
  }
  if (kind !== "partner" && !role) {
    return json({ error: "role is required for a staff invite" }, 400);
  }
  if (kind === "partner" && !partner_id) {
    return json({ error: "partner_id is required for a partner invite" }, 400);
  }

  const { data: callerMembership, error: membershipLookupErr } = await callerClient
    .from("memberships")
    .select("role, status")
    .eq("org_id", org_id)
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipLookupErr || !callerMembership || callerMembership.role !== "owner") {
    return json({ error: "Only the organization owner can send invites" }, 403);
  }

  // From here on, use the service role - deliberately bypasses RLS for the
  // one operation (creating an auth user) that can never be expressed as an
  // RLS-permitted client insert.
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { org_id, role: kind === "partner" ? "partner" : role },
  });
  if (inviteErr) {
    return json({ error: inviteErr.message }, 400);
  }

  if (kind === "partner") {
    const { error: linkErr } = await admin
      .from("partners")
      .update({ auth_user_id: invited.user.id })
      .eq("id", partner_id)
      .eq("org_id", org_id);
    if (linkErr) {
      return json({ error: linkErr.message }, 400);
    }
    return json({ ok: true });
  }

  const { error: insertErr } = await admin.from("memberships").insert({
    org_id,
    user_id: invited.user.id,
    role,
    status: "invited",
    display_name: display_name ?? null,
    email,
    invited_by: userData.user.id,
  });
  if (insertErr) {
    return json({ error: insertErr.message }, 400);
  }

  return json({ ok: true });
});
