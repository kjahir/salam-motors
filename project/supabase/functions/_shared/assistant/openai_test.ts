import { finalResponseReserveMs, planModelRound } from "./openai.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const DEFAULT_TURN_MS = 30_000;
const reserve = (maxTurnMs = DEFAULT_TURN_MS) => finalResponseReserveMs(maxTurnMs);

Deno.test("default turn budget permits an initial tool-selection round", () => {
  const plan = planModelRound({
    remainingMs: DEFAULT_TURN_MS,
    configuredTimeoutMs: 45_000,
    round: 0,
    maxRounds: 5,
    reserveMs: reserve(),
  });

  assert(!plan.forceFinal, "the default first round must allow tools");
  assert(
    plan.timeoutMs > 10_000 && plan.timeoutMs < DEFAULT_TURN_MS,
    `expected a usable tool budget inside the turn, got ${plan.timeoutMs}`,
  );
});

Deno.test("near-deadline and final rounds force a text-only response", () => {
  const nearDeadline = planModelRound({
    remainingMs: 14_000,
    configuredTimeoutMs: 45_000,
    round: 1,
    maxRounds: 5,
    reserveMs: reserve(),
  });
  const lastRound = planModelRound({
    remainingMs: DEFAULT_TURN_MS,
    configuredTimeoutMs: 45_000,
    round: 4,
    maxRounds: 5,
    reserveMs: reserve(),
  });

  assert(nearDeadline.forceFinal, "a near-deadline round must finalize");
  assert(
    nearDeadline.timeoutMs < 14_000,
    "the final request must stay inside the remaining deadline",
  );
  assert(lastRound.forceFinal, "the final permitted round must finalize");
});

Deno.test("every tool-selection round expires with the final-response reserve intact", () => {
  // The property behind the MODEL_TIMEOUT bug: a tool round's budget is always
  // `remaining - reserve`, so whichever round is in flight when the budget runs out, the
  // abort lands with the reserve still unspent. That is why runOpenAITurn must treat a
  // non-final MODEL_TIMEOUT as "switch to a text-only answer" rather than as a failed turn.
  for (const elapsedMs of [0, 2_000, 5_000, 9_000, 12_000]) {
    const remainingMs = DEFAULT_TURN_MS - elapsedMs;
    const plan = planModelRound({
      remainingMs,
      configuredTimeoutMs: 45_000,
      round: 1,
      maxRounds: 5,
      reserveMs: reserve(),
    });
    if (plan.forceFinal) continue;
    const unspentAtAbortMs = remainingMs - plan.timeoutMs;
    assert(
      unspentAtAbortMs >= reserve(),
      `a tool round starting at ${elapsedMs}ms leaves only ${unspentAtAbortMs}ms in reserve`,
    );
  }
});

Deno.test("raising the turn budget actually buys the final answer more time", () => {
  // The regression that made the first timeout fix insufficient: the reserve was a flat
  // 10s, so ASSISTANT_MAX_TURN_MS only ever fed the tool rounds and the answer stayed
  // pinned at ten seconds however large the budget got. A production turn degraded to its
  // final round, was handed 9,709ms, and timed out writing the answer up.
  const small = finalResponseReserveMs(30_000);
  const large = finalResponseReserveMs(60_000);

  assert(
    large > small,
    `a bigger turn budget must reserve more for the answer (${small} -> ${large})`,
  );
  assert(
    large >= 25_000,
    `the maximum turn budget must leave real time to answer, got ${large}`,
  );
  assert(
    finalResponseReserveMs(10_000) >= 10_000,
    "the reserve must never drop below the original ten second floor",
  );

  // ...and the reserve must still leave room to actually call tools.
  const plan = planModelRound({
    remainingMs: 60_000,
    configuredTimeoutMs: 45_000,
    round: 0,
    maxRounds: 5,
    reserveMs: large,
  });
  assert(!plan.forceFinal, "a full budget must still allow a tool round");
  assert(plan.timeoutMs > 0, "the tool round must get a positive budget");
});

/**
 * Simulates a whole turn to count how many rounds actually get a tool budget before
 * planModelRound forces a text-only answer.
 */
function reachableToolRounds(input: {
  maxTurnMs: number;
  maxRounds: number;
  spendMsPerRound: number;
}): number {
  const reserveMs = finalResponseReserveMs(input.maxTurnMs);
  let remainingMs = input.maxTurnMs;
  let toolRounds = 0;
  for (let round = 0; round < input.maxRounds; round += 1) {
    const plan = planModelRound({
      remainingMs,
      configuredTimeoutMs: 45_000,
      round,
      maxRounds: input.maxRounds,
      reserveMs,
    });
    if (plan.forceFinal) break;
    toolRounds += 1;
    remainingMs -= Math.min(input.spendMsPerRound, plan.timeoutMs);
    if (remainingMs <= 250) break;
  }
  return toolRounds;
}

Deno.test("the last configured round is never a tool round", () => {
  // isLastRound forces a text-only answer, so maxToolRounds=N buys at most N-1 rounds that
  // can call a tool. Configuring 5 advertises a depth the loop cannot reach even when every
  // round is instant.
  for (const maxRounds of [2, 3, 5, 8]) {
    const rounds = reachableToolRounds({
      maxTurnMs: 60_000,
      maxRounds,
      spendMsPerRound: 1,
    });
    assert(
      rounds <= maxRounds - 1,
      `maxRounds=${maxRounds} reached ${rounds} tool rounds; the final round must be text-only`,
    );
  }
});

Deno.test("cutting the round default from 5 to 3 costs no reachable depth", () => {
  // The justification for the change: at the latency this model actually shows (a
  // tool-selection round costing 6s against a 30s turn), the reserve leaves room for two
  // tool rounds either way. Rounds 4 and 5 were never reached, so removing them removes
  // nothing but the false impression that raising the count would help.
  const spendMsPerRound = 6_000;
  for (const maxTurnMs of [30_000, 45_000, 60_000]) {
    const wasReachable = reachableToolRounds({
      maxTurnMs,
      maxRounds: 5,
      spendMsPerRound,
    });
    const nowReachable = reachableToolRounds({
      maxTurnMs,
      maxRounds: 3,
      spendMsPerRound,
    });
    assert(
      nowReachable === Math.min(wasReachable, 2),
      `at ${maxTurnMs}ms the default drop changed depth from ${wasReachable} to ${nowReachable}`,
    );
  }
});

Deno.test("wall clock, not maxToolRounds, is what caps tool depth", () => {
  const realistic = reachableToolRounds({
    maxTurnMs: DEFAULT_TURN_MS,
    maxRounds: 8,
    spendMsPerRound: 6_000,
  });
  assert(
    realistic === 2,
    `expected 2 reachable tool rounds at 6s/round on a 30s turn, got ${realistic}`,
  );

  // Buying depth means buying wall clock, not rounds: the round cap is raised to the
  // configurable maximum here and the turn budget is the only thing that moves the number.
  const roomier = reachableToolRounds({
    maxTurnMs: 60_000,
    maxRounds: 8,
    spendMsPerRound: 6_000,
  });
  assert(
    roomier > realistic,
    `a larger turn budget must buy more tool rounds, got ${roomier}`,
  );
});
