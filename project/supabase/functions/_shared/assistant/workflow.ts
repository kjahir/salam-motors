/**
 * The eight workflow steps an Ask Salam run moves through. Every trace event
 * declares the step it belongs to, so the Audit timeline can be read as the
 * workflow rather than as a flat list of implementation events.
 *
 * This is deliberately separate from a trace event's `category`
 * (request/context/model/tool/validation/persistence/response/error). Category
 * says *what kind* of thing happened and is useful to an engineer; step says
 * *where in the run* it happened and is what a dealership owner reading the
 * audit trail actually wants. One step routinely spans several categories —
 * GROUND_ANSWER is four `validation` events plus a `model` one — which is why
 * grouping by category never produced a readable timeline.
 *
 * Keep the numbers in sync with:
 *   - supabase/migrations/20260802093000_assistant_trace_workflow_steps.sql
 *   - src/lib/assistantWorkflow.ts (the frontend's labels for the same steps)
 */
export const WORKFLOW_STEP = {
  /** Authenticate the caller, resolve their role, and load conversation context. */
  AUTHENTICATE: 1,
  /** Turn a voice recording into the text the run is about. Skipped for typed input. */
  TRANSCRIBE: 2,
  /** Work out what was asked and call the tools that role is allowed to use. */
  CLASSIFY_AND_TOOLS: 3,
  /** Build the answer and its typed UI blocks, and check them against tool output. */
  GROUND_ANSWER: 4,
  /** Put a write in front of the user for explicit confirmation. */
  CONFIRM: 5,
  /** Run the confirmed write once, transactionally. */
  EXECUTE: 6,
  /** Persist the turn, its tool calls, and this trace. */
  RECORD: 7,
  /** Read the answer aloud. Skipped unless voice output was asked for. */
  SYNTHESIZE_SPEECH: 8,
} as const;

export type AssistantWorkflowStep =
  (typeof WORKFLOW_STEP)[keyof typeof WORKFLOW_STEP];

/** Stable slugs, used as i18n keys on the frontend and in trace details. */
export const WORKFLOW_STEP_KEY: Record<AssistantWorkflowStep, string> = {
  1: "authenticate",
  2: "transcribe",
  3: "classifyAndTools",
  4: "groundAnswer",
  5: "confirm",
  6: "execute",
  7: "record",
  8: "synthesizeSpeech",
};
