import { assistantInstructions } from "./prompt.ts";
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
  // lastIndexOf: the AUTHORIZATION rules reference the section by name near the top, so
  // the first occurrence is a cross-reference, not the section itself.
  assert(
    owner.lastIndexOf("REQUEST CONTEXT") > shared - 200,
    "REQUEST CONTEXT should sit at the end, where the prefix stops being shared",
  );
});
