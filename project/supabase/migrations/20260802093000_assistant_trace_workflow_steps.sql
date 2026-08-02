/*
# Ask Salam traces carry the workflow step they belong to

## The problem
`assistant_trace_events` (20260729140000) records a flat, time-ordered list of
implementation events, and the Audit page renders it as exactly that: 23 rows
tagged with raw keys like `response.schema.normalized`, one after another. There
is no way to tell which of the assistant's workflow steps an event belongs to.

The existing `category` column does not answer that question either. It is an
engineering taxonomy (request / context / model / tool / validation /
persistence / response / error) that cuts *across* the workflow rather than
following it: grounding the answer spans four `validation` events and one
`model` event, while executing a confirmed action spans `tool`, `response` and
`error`. Grouping by category actively scatters a single workflow step.

## The eight steps
1. authenticate and load role context
2. optionally transcribe speech
3. classify intent and call approved tools
4. ground answer and typed UI blocks
5. confirm sensitive actions
6. execute idempotently
7. record trace and tool calls
8. optionally synthesize speech

These are the assistant's own workflow nodes. `workflow_step` is declared at
each emit site (see supabase/functions/_shared/assistant/workflow.ts), so a new
trace event cannot silently land outside a step — the column is NOT NULL and the
TypeScript type requires it.

## Data handling
Additive column. Existing rows are backfilled from their `event_key` by the map
in step 2 below, which is the same mapping the emitters now declare directly, so
historic runs group identically to new ones. The column is only made NOT NULL
after the backfill; if any historic row carried an event_key not in the map, the
`SET NOT NULL` would fail loudly rather than leave the table half-classified —
so step 3 asserts the backfill is complete first and names the offenders.

No row is deleted and no existing column is modified.
*/

-- ============================================================
-- Step 1: add the column, nullable for now
-- ============================================================
ALTER TABLE public.assistant_trace_events
  ADD COLUMN IF NOT EXISTS workflow_step smallint;

-- ============================================================
-- Step 2: backfill historic rows from their event_key
-- ============================================================
UPDATE public.assistant_trace_events
SET workflow_step = CASE event_key
  -- 1. authenticate and load role context
  WHEN 'turn.request.accepted'               THEN 1
  WHEN 'context.role.resolved'               THEN 1
  WHEN 'context.history.loaded'              THEN 1
  -- 2. optionally transcribe speech
  WHEN 'voice.transcription.completed'       THEN 2
  -- 3. classify intent and call approved tools
  WHEN 'model.round.started'                 THEN 3
  WHEN 'model.round.completed'               THEN 3
  WHEN 'tool.batch.planned'                  THEN 3
  WHEN 'tool.execution.started'              THEN 3
  WHEN 'tool.execution.completed'            THEN 3
  -- 4. ground answer and typed UI blocks
  WHEN 'response.structured_json.parsed'     THEN 4
  WHEN 'response.schema.normalized'          THEN 4
  WHEN 'response.language.checked'           THEN 4
  WHEN 'response.language_correction.started'   THEN 4
  WHEN 'response.language_correction.completed' THEN 4
  WHEN 'response.grounding.completed'        THEN 4
  WHEN 'turn.response.generated'             THEN 4
  -- 5. confirm sensitive actions
  WHEN 'confirmation.request.accepted'       THEN 5
  WHEN 'confirmation.proposal.revalidated'   THEN 5
  -- 6. execute idempotently
  WHEN 'confirmation.transaction.started'    THEN 6
  WHEN 'confirmation.transaction.completed'  THEN 6
  WHEN 'confirmation.receipt.generated'      THEN 6
  WHEN 'confirmation.completed'              THEN 6
  WHEN 'confirmation.failed'                 THEN 6
  -- 7. record trace and tool calls
  WHEN 'turn.response.persisted'             THEN 7
  WHEN 'turn.completed'                      THEN 7
  WHEN 'turn.failed'                         THEN 7
  -- 8. optionally synthesize speech
  WHEN 'voice.speech.synthesized'            THEN 8
  ELSE NULL
END
WHERE workflow_step IS NULL;

-- ============================================================
-- Step 3: refuse to continue if anything went unclassified
-- ============================================================
do $$
declare
  unmapped text;
begin
  select string_agg(distinct event_key, ', ')
    into unmapped
  from public.assistant_trace_events
  where workflow_step is null;

  if unmapped is not null then
    raise exception
      'Cannot classify Ask Salam traces: these event_key values are missing from the workflow-step map: %',
      unmapped;
  end if;
end $$;

-- ============================================================
-- Step 4: lock it down
-- ============================================================
ALTER TABLE public.assistant_trace_events
  ALTER COLUMN workflow_step SET NOT NULL;

ALTER TABLE public.assistant_trace_events
  DROP CONSTRAINT IF EXISTS assistant_trace_events_workflow_step_check;
ALTER TABLE public.assistant_trace_events
  ADD CONSTRAINT assistant_trace_events_workflow_step_check
  CHECK (workflow_step BETWEEN 1 AND 8);

-- The Audit page reads a whole run and groups by step, so this is the ordering
-- it actually scans in.
CREATE INDEX IF NOT EXISTS idx_assistant_trace_run_step
  ON public.assistant_trace_events (run_id, workflow_step, occurred_at, id);

COMMENT ON COLUMN public.assistant_trace_events.workflow_step IS
  'Which of the eight Ask Salam workflow steps produced this event (1 authenticate/context, 2 transcribe, 3 classify+tools, 4 ground answer, 5 confirm, 6 execute, 7 record, 8 synthesize speech). Declared by the emitter in _shared/assistant/workflow.ts.';
