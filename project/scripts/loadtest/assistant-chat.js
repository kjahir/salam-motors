// k6 load-test skeleton for the assistant-turn Supabase Edge Function.
//
// Simulates a handful of concurrent virtual users each sending a chat
// message to Ask Salam (supabase/functions/assistant-turn) and reports
// latency / error-rate stats. This is intentionally a starting skeleton,
// not an exhaustive suite - see the README in this directory for how to
// point it at staging and extend it (conversation reuse, action-confirm
// flow, streaming, etc).
//
// Run with: k6 run scripts/loadtest/assistant-chat.js
// See README.md in this directory for required env vars and the
// production-hostname guard below.

import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// ============================================================
// Config (env vars - see README.md)
// ============================================================
const TARGET_BASE_URL = __ENV.TARGET_BASE_URL || "";
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || "";
const AUTH_BEARER_TOKEN = __ENV.AUTH_BEARER_TOKEN || "";
const VUS = Number(__ENV.LOADTEST_VUS || 5);
const DURATION = __ENV.LOADTEST_DURATION || "30s";

// ------------------------------------------------------------
// Hard safety guard: refuse to run against anything that looks like a
// production host. This is a simple string match, not a substitute for
// pointing the script at a disposable staging/local target - see README.
// ------------------------------------------------------------
const PRODUCTION_HOSTNAME_MARKERS = [
  "salam-motors.com",
  "app.salam-motors",
  "salammotors.com",
  "prod.supabase.co",
];

function assertNotProduction(url) {
  if (!url) {
    throw new Error(
      "TARGET_BASE_URL is required. Set it to a staging/local base URL, e.g. " +
        "TARGET_BASE_URL=https://<staging-project-ref>.supabase.co k6 run scripts/loadtest/assistant-chat.js",
    );
  }
  const lowered = url.toLowerCase();
  for (const marker of PRODUCTION_HOSTNAME_MARKERS) {
    if (lowered.includes(marker)) {
      throw new Error(
        `TARGET_BASE_URL ("${url}") looks like a production hostname (matched "${marker}"). ` +
          "Refusing to run. Point this at a disposable staging or local Supabase project instead.",
      );
    }
  }
  if (!/\b(staging|local|localhost|127\.0\.0\.1|dev)\b/i.test(lowered)) {
    // Not a hard failure - some staging project refs are opaque random
    // strings with no "staging" marker in them - but flag it loudly so a
    // human has to notice before load is generated against an unfamiliar host.
    console.warn(
      `WARNING: TARGET_BASE_URL ("${url}") does not obviously look like a staging/local host. ` +
        "Double-check this is not production before proceeding.",
    );
  }
}

assertNotProduction(TARGET_BASE_URL);

// ============================================================
// Custom metrics
// ============================================================
const assistantErrorRate = new Rate("assistant_turn_errors");
const assistantLatency = new Trend("assistant_turn_duration", true);

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: {
    // Loose defaults for a skeleton run - tighten once you have a real
    // staging baseline.
    http_req_failed: ["rate<0.05"],
    assistant_turn_errors: ["rate<0.05"],
    assistant_turn_duration: ["p(95)<8000"],
  },
};

const SAMPLE_MESSAGES = [
  "How many vehicles are currently in Ready to List status?",
  "What's the total expense on the last vehicle I onboarded?",
  "Show me open compliance alerts.",
  "What was our profit margin on the last completed sale?",
];

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export default function assistantChatScenario() {
  const url = `${TARGET_BASE_URL.replace(/\/$/, "")}/functions/v1/assistant-turn`;

  const body = JSON.stringify({
    message: pick(SAMPLE_MESSAGES),
    locale: "en",
    context: { surface: "desktop", page: "dashboard" },
    stream: false,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH_BEARER_TOKEN}`,
      apikey: SUPABASE_ANON_KEY,
    },
    tags: { name: "assistant_turn" },
  };

  const res = http.post(url, body, params);

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "response has a turn": (r) => {
      try {
        const parsed = JSON.parse(r.body);
        return Boolean(parsed && (parsed.turn || parsed.conversationId));
      } catch {
        return false;
      }
    },
  });

  assistantErrorRate.add(!ok);
  assistantLatency.add(res.timings.duration);

  sleep(1 + Math.random() * 2);
}
