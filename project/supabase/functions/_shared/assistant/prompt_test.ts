import { assistantInstructions, dealershipToday } from "./prompt.ts";
import type {
  AssistantPrincipal,
  AssistantSurfaceContext,
} from "./types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const principal: AssistantPrincipal = {
  kind: "staff",
  userId: "00000000-0000-4000-8000-000000000001",
  orgId: "00000000-0000-4000-8000-000000000002",
  role: "owner",
  partnerId: null,
};

function instructions(locale: string): string {
  return assistantInstructions({
    principal,
    locale,
    context: { surface: "desktop", page: "dashboard" },
    conversationId: "00000000-0000-4000-8000-000000000003",
  });
}

Deno.test("Tamil assistant prompt makes the selected response language mandatory", () => {
  const value = instructions("ta-IN");
  if (!value.includes("Tamil") || !value.includes('locale "ta-IN"')) {
    throw new Error("Tamil locale directive is missing");
  }
});

Deno.test("Hindi assistant prompt makes the selected response language mandatory", () => {
  const value = instructions("hi-IN");
  if (!value.includes("Hindi") || !value.includes('locale "hi-IN"')) {
    throw new Error("Hindi locale directive is missing");
  }
});

Deno.test("instructions keep per-request values in a trailing block", () => {
  // OpenAI prompt caching keys on the longest common prefix, so the first interpolated
  // value is a cache boundary. This once sat in the second line (`principal=...`), leaving
  // almost nothing shareable. Any edit that moves a per-request value back up front will
  // fail here rather than quietly costing latency on every turn.
  const build = (role: string, locale: string, conversationId: string) =>
    assistantInstructions({
      principal: {
        kind: "staff",
        role,
        userId: "user-1",
        orgId: "org-1",
      } as unknown as AssistantPrincipal,
      locale,
      context: { surface: "web" } as unknown as AssistantSurfaceContext,
      conversationId,
    });

  const owner = build("owner", "en", "conversation-a");
  const manager = build("manager", "ta-IN", "conversation-b");

  let shared = 0;
  while (
    shared < owner.length && shared < manager.length &&
    owner[shared] === manager[shared]
  ) shared += 1;

  assert(
    shared / owner.length > 0.7,
    `only ${Math.round(shared / owner.length * 100)}% of the prompt is a shared prefix; ` +
      "a per-request value moved ahead of the invariant rules",
  );
  // The precise property, with no arbitrary tolerance: the shared prefix reaches *into*
  // REQUEST CONTEXT, which means everything before that section is identical across
  // callers. lastIndexOf because the AUTHORIZATION rules cross-reference the section by
  // name near the top.
  assert(
    shared > owner.lastIndexOf("REQUEST CONTEXT"),
    "the prompt diverges before REQUEST CONTEXT, so a per-request value leaked into the shared rules",
  );
});

Deno.test("the model is told what day it is, in dealership time", () => {
  // Without this the model had no sense of the present. Asked to "explain this month's
  // profit" it guessed a month near its training data, queried it, found nothing, and
  // reported a confident zero for a period the dealership never traded in.
  const instructions = assistantInstructions({
    principal,
    locale: "en",
    context: { surface: "web" } as unknown as AssistantSurfaceContext,
    conversationId: "c1",
    now: new Date("2026-08-03T12:00:00Z"),
  });
  assert(instructions.includes("2026-08-03"), "today's date is not in the prompt");
  assert(
    instructions.includes("2026-08-01") && instructions.includes("2026-08-31"),
    "this month's bounds are not supplied",
  );
  assert(
    instructions.includes("Asia/Kolkata"),
    "the dealership time zone is not stated",
  );
});

Deno.test("dealership date rolls over on Kolkata's clock, not UTC's", () => {
  // 19:00 UTC is 00:30 the next day in Kolkata. Deriving the date from the server clock
  // would put every late-evening turn on the previous day — and, at month end, in the
  // previous month.
  const lateUtc = dealershipToday(new Date("2026-08-03T19:00:00Z"));
  assert(lateUtc.iso === "2026-08-04", `expected 2026-08-04, got ${lateUtc.iso}`);

  const monthEnd = dealershipToday(new Date("2026-08-31T19:00:00Z"));
  assert(monthEnd.iso === "2026-09-01", `expected 2026-09-01, got ${monthEnd.iso}`);
  assert(
    monthEnd.monthStart === "2026-09-01" && monthEnd.monthEnd === "2026-09-30",
    `month bounds followed the wrong month: ${monthEnd.monthStart}..${monthEnd.monthEnd}`,
  );
});

Deno.test("month bounds handle short months and leap years", () => {
  assert(dealershipToday(new Date("2026-02-10T06:00:00Z")).monthEnd === "2026-02-28", "Feb 2026");
  assert(dealershipToday(new Date("2028-02-10T06:00:00Z")).monthEnd === "2028-02-29", "Feb 2028 is a leap year");
  assert(dealershipToday(new Date("2026-04-10T06:00:00Z")).monthEnd === "2026-04-30", "April has 30 days");
  assert(dealershipToday(new Date("2026-12-10T06:00:00Z")).monthEnd === "2026-12-31", "December has 31 days");
});
