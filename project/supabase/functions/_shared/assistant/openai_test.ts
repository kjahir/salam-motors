import { planModelRound } from "./openai.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("default turn budget permits an initial tool-selection round", () => {
  const plan = planModelRound({
    remainingMs: 30_000,
    configuredTimeoutMs: 45_000,
    round: 0,
    maxRounds: 5,
  });

  assert(!plan.forceFinal, "the default first round must allow tools");
  assert(
    plan.timeoutMs > 19_000 && plan.timeoutMs < 20_000,
    `expected a roughly 20 second model budget, got ${plan.timeoutMs}`,
  );
});

Deno.test("near-deadline and final rounds force a text-only response", () => {
  const nearDeadline = planModelRound({
    remainingMs: 14_000,
    configuredTimeoutMs: 45_000,
    round: 1,
    maxRounds: 5,
  });
  const lastRound = planModelRound({
    remainingMs: 30_000,
    configuredTimeoutMs: 45_000,
    round: 4,
    maxRounds: 5,
  });

  assert(nearDeadline.forceFinal, "a near-deadline round must finalize");
  assert(
    nearDeadline.timeoutMs < 14_000,
    "the final request must stay inside the remaining deadline",
  );
  assert(lastRound.forceFinal, "the final permitted round must finalize");
});
