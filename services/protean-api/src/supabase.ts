// Supabase clients, built per request.
//
// The important property, preserved from when this ran as an edge function: reads happen
// through a *caller-scoped* client built from the browser's own access token, so row-level
// security decides what the caller can see. Running outside Supabase changes nothing about
// that — the anon key plus a forwarded Authorization header behaves identically from a VPC
// as it does from an edge function.
//
// The service-role client is the exception, used only where no caller session exists (the
// Protean webhook) or where the caller's role deliberately cannot write (storing a
// generated agreement — see protean/sale-document.ts).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ServiceConfig } from "./config.ts";
import type { SupabaseClientLike } from "./auth.ts";

export function callerClient(
  config: ServiceConfig,
  authorization: string,
): SupabaseClientLike {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function adminClient(config: ServiceConfig): SupabaseClientLike {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
