import { isConfigured, loadGoogleBusinessProfileConfig } from "./config.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("loadGoogleBusinessProfileConfig reads GOOGLE_BUSINESS_PROFILE_* secrets and trims blanks to null", () => {
  const original = {
    token: Deno.env.get("GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN"),
    account: Deno.env.get("GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID"),
    location: Deno.env.get("GOOGLE_BUSINESS_PROFILE_LOCATION_ID"),
  };
  try {
    Deno.env.delete("GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN");
    Deno.env.set("GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID", "   ");
    Deno.env.delete("GOOGLE_BUSINESS_PROFILE_LOCATION_ID");

    const config = loadGoogleBusinessProfileConfig();
    assert(config.accessToken === null, "missing token should be null");
    assert(config.accountId === null, "blank account id should be normalized to null");
    assert(config.locationId === null, "missing location should be null");
    assert(!isConfigured(config), "config with any missing field is not configured");
  } finally {
    for (const [key, value] of Object.entries(original)) {
      const envName = key === "token"
        ? "GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN"
        : key === "account"
        ? "GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID"
        : "GOOGLE_BUSINESS_PROFILE_LOCATION_ID";
      if (value === undefined) Deno.env.delete(envName);
      else Deno.env.set(envName, value);
    }
  }
});

Deno.test("isConfigured requires all three fields to be present", () => {
  assert(
    !isConfigured({ accessToken: "x", accountId: "y", locationId: null }),
    "missing locationId should not be configured",
  );
  assert(
    !isConfigured({ accessToken: null, accountId: "y", locationId: "z" }),
    "missing accessToken should not be configured",
  );
  assert(
    isConfigured({ accessToken: "x", accountId: "y", locationId: "z" }),
    "all three fields present should be configured",
  );
});
