/*
# Terminal Ask Salam failures point at the step that actually failed

## The bug
20260802093000 classified every trace event by workflow step, but it put the two
terminal failure events — `turn.failed` and `confirmation.failed` — in the step
whose code raises them rather than the step that broke:

  - `turn.failed` is logged from the catch block at the bottom of runChatTurn,
    which was tagged step 7 (record trace and tool calls)
  - `confirmation.failed` likewise, tagged step 6 (execute idempotently)

Neither block knows why it was reached. The result: a run that timed out while
choosing tools recorded

    step 3  model.round.started   (never completed)
    step 7  turn.failed

so the Audit page showed step 3 as complete and step 7 — writing the audit
record — as the failure. Every failure looked like it happened in the same
place, and it was never the real place.

The emitters now attribute themselves to `AssistantPersistence.currentWorkflowStep`,
the step of the last event logged before the failure. This migration applies the
same correction to rows already written.

## Data handling
Rewrites `workflow_step` on existing `turn.failed` / `confirmation.failed` rows
only, to the step of the immediately preceding trace event in the same run.
Rows with no preceding event (a run that failed before logging anything) keep
what they have. No row is inserted or deleted, no other column is touched, and
`summary` / `details_redacted` are left exactly as recorded — this corrects
where a failure is filed, never what it says.
*/

WITH preceding AS (
  SELECT
    id,
    lag(workflow_step) OVER (PARTITION BY run_id ORDER BY occurred_at, id) AS previous_step,
    event_key
  FROM public.assistant_trace_events
)
UPDATE public.assistant_trace_events AS e
SET workflow_step = p.previous_step
FROM preceding AS p
WHERE p.id = e.id
  AND p.event_key IN ('turn.failed', 'confirmation.failed')
  AND p.previous_step IS NOT NULL
  AND p.previous_step <> e.workflow_step;
