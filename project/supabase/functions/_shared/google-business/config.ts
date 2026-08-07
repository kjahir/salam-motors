// Env/secret loading for the shared VahanExchange-owned Google Business
// Profile account. No live credentials exist yet - these are
// provisioned-but-empty Supabase secrets on the staging project, the same
// pattern as PROTEAN_*. isConfigured() is what gates real vs. simulated
// posting; it will start returning true the moment real values are set,
// with no code change required.

export interface GoogleBusinessProfileConfig {
  accessToken: string | null;
  accountId: string | null;
  locationId: string | null;
}

function env(name: string): string | undefined {
  return Deno.env.get(name)?.trim() || undefined;
}

export function loadGoogleBusinessProfileConfig(): GoogleBusinessProfileConfig {
  return {
    accessToken: env("GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN") ?? null,
    accountId: env("GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID") ?? null,
    locationId: env("GOOGLE_BUSINESS_PROFILE_LOCATION_ID") ?? null,
  };
}

export function isConfigured(config: GoogleBusinessProfileConfig): boolean {
  return Boolean(config.accessToken && config.accountId && config.locationId);
}
