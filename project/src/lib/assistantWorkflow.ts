import type { AssistantTraceEvent } from "./types";

/**
 * The eight workflow steps an Ask Salam run moves through, in order. This is the frontend
 * half of supabase/functions/_shared/assistant/workflow.ts — same numbers, same slugs — and
 * it is what the Audit page groups the execution trace by.
 *
 * The trace's own `category` field (request/context/model/tool/validation/…) is an
 * engineering taxonomy that cuts across these steps: grounding the answer alone spans four
 * `validation` events and one `model` event. Grouping by category produced a timeline
 * nobody could read, which is why the step is now recorded explicitly.
 */
export const ASSISTANT_WORKFLOW_STEPS = [
  { step: 1, key: "authenticate" },
  { step: 2, key: "transcribe" },
  { step: 3, key: "classifyAndTools" },
  { step: 4, key: "groundAnswer" },
  { step: 5, key: "confirm" },
  { step: 6, key: "execute" },
  { step: 7, key: "record" },
  { step: 8, key: "synthesizeSpeech" },
] as const;

export type AssistantWorkflowStep = (typeof ASSISTANT_WORKFLOW_STEPS)[number]["step"];

/**
 * Fallback for rows written before `workflow_step` existed. The migration backfills the
 * column with exactly this mapping, so this only matters if the app is deployed ahead of
 * the migration — in which case a run still groups correctly instead of collapsing into
 * one undifferentiated bucket.
 */
const STEP_BY_EVENT_KEY: Record<string, AssistantWorkflowStep> = {
  "turn.request.accepted": 1,
  "context.role.resolved": 1,
  "context.history.loaded": 1,
  "voice.transcription.completed": 2,
  "model.round.started": 3,
  "model.round.completed": 3,
  "model.round.degraded": 3,
  "model.round.failed": 3,
  "model.output.truncated": 3,
  "tool.batch.planned": 3,
  "tool.execution.started": 3,
  "tool.execution.completed": 3,
  "response.structured_json.parsed": 4,
  "response.schema.normalized": 4,
  "response.language.checked": 4,
  "response.language_correction.started": 4,
  "response.language_correction.completed": 4,
  "response.grounding.completed": 4,
  "turn.response.generated": 4,
  "confirmation.request.accepted": 5,
  "confirmation.proposal.revalidated": 5,
  "confirmation.transaction.started": 6,
  "confirmation.transaction.completed": 6,
  "confirmation.receipt.generated": 6,
  "confirmation.completed": 6,
  "confirmation.failed": 6,
  "turn.response.persisted": 7,
  "turn.completed": 7,
  "turn.failed": 7,
  "voice.speech.synthesized": 8,
};

export function stepOf(event: AssistantTraceEvent): AssistantWorkflowStep | null {
  if (event.workflow_step) return event.workflow_step as AssistantWorkflowStep;
  return STEP_BY_EVENT_KEY[event.event_key] ?? null;
}

export type StepStatus =
  | "failed"
  | "interrupted"
  | "flagged"
  | "completed"
  | "skipped"
  | "pending";

export interface WorkflowStepGroup {
  step: AssistantWorkflowStep;
  key: string;
  events: AssistantTraceEvent[];
  status: StepStatus;
  /** Wall-clock span of the step: first event start to last event end. */
  durationMs: number | null;
}

/**
 * Buckets a run's trace into the eight steps, in workflow order, always returning all
 * eight. A step with no events is real information — "this run never reached confirmation"
 * — and hiding it would put us back to guessing from what happens to be present.
 */
export function groupTraceByWorkflowStep(
  events: AssistantTraceEvent[],
): WorkflowStepGroup[] {
  const byStep = new Map<AssistantWorkflowStep, AssistantTraceEvent[]>();
  for (const event of events) {
    const step = stepOf(event);
    if (step === null) continue;
    const bucket = byStep.get(step) ?? [];
    bucket.push(event);
    byStep.set(step, bucket);
  }

  return ASSISTANT_WORKFLOW_STEPS.map(({ step, key }) => {
    const stepEvents = byStep.get(step) ?? [];
    return { step, key, events: stepEvents, status: rollUpStatus(stepEvents), durationMs: spanOf(stepEvents) };
  });
}

/**
 * Worst-case wins, so a step that failed anywhere reads as failed. "pending" means the run
 * never got here; "skipped" means it got here and the step legitimately did not apply
 * (typed input needs no transcription) — a distinction that matters when reading a run
 * that stopped early.
 */
function rollUpStatus(events: AssistantTraceEvent[]): StepStatus {
  if (events.length === 0) return "pending";
  if (events.some((e) => e.status === "failed")) return "failed";
  // An event is logged `started` before its work and `completed` after, so a step whose
  // last recorded event is still `started` never finished — the run died inside it without
  // getting far enough to say so. Reporting that as "Done" is exactly the kind of lie this
  // view exists to stop; it happens for real when the edge function is killed mid-run and
  // no terminal failure event is ever written.
  if (events[events.length - 1].status === "started") return "interrupted";
  if (events.some((e) => e.status === "flagged")) return "flagged";
  if (events.every((e) => e.status === "skipped")) return "skipped";
  return "completed";
}

function spanOf(events: AssistantTraceEvent[]): number | null {
  if (events.length === 0) return null;
  const times = events.map((e) => new Date(e.occurred_at).getTime()).filter(Number.isFinite);
  if (times.length === 0) return null;
  const last = events[events.length - 1];
  // The final event's own duration is included: an event is logged when its work finishes,
  // so its timestamp is the end of that work, not the start.
  return Math.max(...times) - Math.min(...times) + (last.duration_ms ?? 0);
}
