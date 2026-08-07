import { describe, it, expect } from "vitest";
import { groupTraceByWorkflowStep, stepOf } from "./assistantWorkflow";
import type { AssistantTraceEvent } from "./types";

const event = (patch: Partial<AssistantTraceEvent>): AssistantTraceEvent => ({
  id: 1,
  run_id: "run-1",
  workflow_step: null,
  category: "request",
  event_key: "turn.request.accepted",
  status: "completed",
  summary: "",
  details_redacted: {},
  duration_ms: null,
  occurred_at: "2026-08-02T10:00:00.000Z",
  ...patch,
});

describe("groupTraceByWorkflowStep", () => {
  it("always returns all eight steps in workflow order", () => {
    const groups = groupTraceByWorkflowStep([]);
    expect(groups.map((g) => g.step)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("marks a step the run never reached as pending, not skipped", () => {
    // The distinction is the point: "skipped" means the assistant got here and the step
    // did not apply; "pending" means the run stopped before this step.
    const groups = groupTraceByWorkflowStep([
      event({ id: 1, workflow_step: 1 }),
      event({ id: 2, workflow_step: 2, status: "skipped" }),
    ]);
    expect(groups[0].status).toBe("completed");
    expect(groups[1].status).toBe("skipped");
    expect(groups[2].status).toBe("pending");
  });

  it("reports a step whose last action never completed as interrupted, not done", () => {
    // The real shape of a timed-out run: tool selection opened a round and the run died
    // inside it. Reporting step 3 as "Done" here is how a MODEL_TIMEOUT in tool selection
    // ended up looking like a failure in step 7.
    const groups = groupTraceByWorkflowStep([
      event({ id: 1, workflow_step: 3, event_key: "model.round.started", status: "started" }),
      event({ id: 2, workflow_step: 3, event_key: "model.round.completed", duration_ms: 1876 }),
      event({ id: 3, workflow_step: 3, event_key: "model.round.started", status: "started" }),
    ]);
    expect(groups[2].status).toBe("interrupted");
  });

  it("does not call a step interrupted when its started events all closed", () => {
    const groups = groupTraceByWorkflowStep([
      event({ id: 1, workflow_step: 3, event_key: "tool.execution.started", status: "started" }),
      event({ id: 2, workflow_step: 3, event_key: "tool.execution.completed" }),
    ]);
    expect(groups[2].status).toBe("completed");
  });

  it("rolls a step up to its worst event status", () => {
    const groups = groupTraceByWorkflowStep([
      event({ id: 1, workflow_step: 3, status: "completed" }),
      event({ id: 2, workflow_step: 3, status: "failed" }),
      event({ id: 3, workflow_step: 3, status: "completed" }),
    ]);
    expect(groups[2].status).toBe("failed");

    const flagged = groupTraceByWorkflowStep([
      event({ id: 1, workflow_step: 4, status: "completed" }),
      event({ id: 2, workflow_step: 4, status: "flagged" }),
    ]);
    expect(flagged[3].status).toBe("flagged");
  });

  it("spans a step from its first event to the end of its last", () => {
    const groups = groupTraceByWorkflowStep([
      event({ id: 1, workflow_step: 3, occurred_at: "2026-08-02T10:00:00.000Z" }),
      event({
        id: 2,
        workflow_step: 3,
        occurred_at: "2026-08-02T10:00:02.000Z",
        duration_ms: 500,
      }),
    ]);
    // 2s between the two events, plus the 500ms the last event itself reports.
    expect(groups[2].durationMs).toBe(2_500);
  });

  it("falls back to event_key for rows written before workflow_step existed", () => {
    // Guards the deploy-ahead-of-migration window: historic runs must still group.
    expect(stepOf(event({ event_key: "tool.execution.started" }))).toBe(3);
    expect(stepOf(event({ event_key: "confirmation.transaction.started" }))).toBe(6);
    expect(stepOf(event({ event_key: "voice.speech.synthesized" }))).toBe(8);

    const groups = groupTraceByWorkflowStep([
      event({ id: 1, event_key: "response.grounding.completed" }),
    ]);
    expect(groups[3].events).toHaveLength(1);
  });

  it("prefers the stored step over the event_key fallback", () => {
    expect(stepOf(event({ workflow_step: 7, event_key: "tool.execution.started" }))).toBe(7);
  });

  it("drops events it cannot place rather than inventing a step", () => {
    const groups = groupTraceByWorkflowStep([event({ event_key: "something.unknown" })]);
    expect(groups.every((g) => g.events.length === 0)).toBe(true);
  });
});
