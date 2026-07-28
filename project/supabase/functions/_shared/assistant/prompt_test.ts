import { assistantInstructions } from "./prompt.ts";
import type { AssistantPrincipal } from "./types.ts";

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
