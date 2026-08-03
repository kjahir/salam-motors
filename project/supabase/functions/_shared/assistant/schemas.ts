import type { JsonSchema } from "./actions.ts";
import { ASSISTANT_PAGES } from "./navigation.ts";

const nullableString: JsonSchema = { type: ["string", "null"] };
const nullableNumber: JsonSchema = { type: ["number", "null"] };
const scalar: JsonSchema = {
  type: ["string", "number", "boolean", "null"],
};

/*
Item ceilings for the collection blocks, sized against ASSISTANT_MAX_OUTPUT_TOKENS.

These used to be 100 (200 for timeline events), set independently of the token cap, and the
two never agreed: a vehicle_collection item is a ~15-field object, so at the ~2.8 chars per
token this schema actually produces, 100 of them plus provenance needs well over 8,000
tokens. The schema was advertising a shape no turn could physically emit. The model would
start filling it, hit max_output_tokens mid-object, and the truncated JSON failed to parse —
surfacing as "the AI service returned an invalid structured response" for what was really
our own ceiling.

20 keeps a full collection comfortably inside the cap and is the better answer anyway: a
question spanning 53 vehicles wants a count and the ones that matter, not 53 cards. The
prompt tells the model to lead with totals and render only the most relevant items when
there are more, so the cap shapes the answer rather than silently clipping it.
*/
const COLLECTION_MAX_ITEMS = 20;
const DETAIL_MAX_ITEMS = 24;

function strictObject(
  properties: Record<string, JsonSchema>,
): JsonSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

const replyAction = strictObject({
  kind: { type: "string", enum: ["reply"] },
  label: { type: "string", minLength: 1, maxLength: 160 },
  message: { type: "string", minLength: 1, maxLength: 4_000 },
});

const navigateAction = strictObject({
  kind: { type: "string", enum: ["navigate"] },
  label: { type: "string", minLength: 1, maxLength: 160 },
  page: { type: "string", enum: [...ASSISTANT_PAGES] },
  params: strictObject({
    vehicleId: nullableString,
    historyVehicleId: nullableString,
    tab: nullableString,
    openEditVehicle: { type: ["boolean", "null"] },
    highlightPolicyId: nullableString,
  }),
});

const invokeAction = strictObject({
  kind: { type: "string", enum: ["invoke"] },
  label: { type: "string", minLength: 1, maxLength: 160 },
  actionToken: { type: "string", minLength: 1, maxLength: 8_000 },
  risk: {
    type: "string",
    enum: ["low", "medium", "high", "critical"],
  },
  confirmationText: nullableString,
});

const metricBlock = strictObject({
  type: { type: "string", enum: ["metric_grid"] },
  title: { type: "string", maxLength: 200 },
  items: {
    type: "array",
    maxItems: 24,
    items: strictObject({
      label: { type: "string", minLength: 1, maxLength: 160 },
      value: { type: ["string", "number"] },
      format: {
        type: "string",
        enum: ["inr", "number", "percent", "days", "text"],
      },
      tone: {
        type: "string",
        enum: ["neutral", "info", "success", "warning", "danger"],
      },
      helpText: nullableString,
    }),
  },
});

const vehicleBlock = strictObject({
  type: { type: "string", enum: ["vehicle_collection"] },
  title: { type: "string", maxLength: 200 },
  description: nullableString,
  view: { type: "string", enum: ["cards", "table"] },
  /*
  Reference plus judgement, not a transcription.

  This used to require all 21 vehicle fields on every item, so twenty vehicles cost 420
  forced key/value emissions of data the server already held from the tool call — roughly
  2,300 output tokens, about nine seconds of generation, to retype rows that were already
  in memory. `hydrateBlocks` now fills the facts server-side from those rows and the model
  supplies only what it alone knows: which rows matter, and why.

  Two consequences beyond speed: the model cannot misreport a price it never types, and an
  id it invented has nothing to hydrate from, so it is dropped rather than rendered.
  */
  items: {
    type: "array",
    maxItems: COLLECTION_MAX_ITEMS,
    items: strictObject({
      id: { type: "string", minLength: 1, maxLength: 80 },
      explanation: nullableString,
    }),
  },
  shown: { type: "integer", minimum: 0 },
  total: { type: "integer", minimum: 0 },
});

const alertBlock = strictObject({
  type: { type: "string", enum: ["alert_list"] },
  title: { type: "string", maxLength: 200 },
  /** Hydrated server-side from the alert rows. See vehicleBlock.items. */
  items: {
    type: "array",
    maxItems: COLLECTION_MAX_ITEMS,
    items: strictObject({
      id: { type: "string", minLength: 1, maxLength: 80 },
      explanation: nullableString,
    }),
  },
});

const timelineBlock = strictObject({
  type: { type: "string", enum: ["timeline"] },
  title: { type: "string", maxLength: 200 },
  entityId: nullableString,
  events: {
    type: "array",
    maxItems: DETAIL_MAX_ITEMS,
    items: strictObject({
      id: nullableString,
      at: { type: "string", minLength: 1, maxLength: 80 },
      label: { type: "string", minLength: 1, maxLength: 240 },
      status: nullableString,
      reason: nullableString,
      tone: {
        type: "string",
        enum: ["neutral", "info", "success", "warning", "danger"],
      },
    }),
  },
});

const confirmationBlock = strictObject({
  type: { type: "string", enum: ["confirmation"] },
  title: { type: "string", minLength: 1, maxLength: 200 },
  summary: { type: "string", minLength: 1, maxLength: 1_000 },
  risk: {
    type: "string",
    enum: ["low", "medium", "high", "critical"],
  },
  changes: {
    type: "array",
    maxItems: 50,
    items: strictObject({
      label: { type: "string", minLength: 1, maxLength: 160 },
      from: scalar,
      to: scalar,
    }),
  },
  confirm: invokeAction,
  cancel: replyAction,
  expiresAt: { type: "string", minLength: 1, maxLength: 80 },
});

const receiptBlock = strictObject({
  type: { type: "string", enum: ["action_receipt"] },
  status: {
    type: "string",
    enum: ["success", "partial", "failed"],
  },
  title: { type: "string", minLength: 1, maxLength: 200 },
  message: nullableString,
  details: {
    type: "array",
    maxItems: DETAIL_MAX_ITEMS,
    items: strictObject({
      label: { type: "string", minLength: 1, maxLength: 160 },
      value: scalar,
    }),
  },
  auditId: nullableString,
});

const emptyBlock = strictObject({
  type: { type: "string", enum: ["empty_state"] },
  title: { type: "string", minLength: 1, maxLength: 200 },
  explanation: nullableString,
});

const source = strictObject({
  entity: { type: "string", minLength: 1, maxLength: 80 },
  id: nullableString,
  label: nullableString,
  count: nullableNumber,
});

export const MODEL_TURN_SCHEMA: JsonSchema = strictObject({
  schemaVersion: { type: "string", enum: ["1.0"] },
  turnId: { type: "string", minLength: 1, maxLength: 100 },
  conversationId: { type: "string", minLength: 1, maxLength: 100 },
  locale: { type: "string", minLength: 2, maxLength: 40 },
  answer: strictObject({
    // 20_000 chars is ~7_000 tokens — more than twice the entire output cap, so this
    // bound never bound anything. 6_000 leaves room for a collection and provenance
    // alongside it, and a schema-clipped string still yields valid JSON, unlike a
    // response cut off at max_output_tokens.
    text: { type: "string", minLength: 1, maxLength: 6_000 },
    tone: {
      type: "string",
      enum: ["neutral", "info", "success", "warning", "danger"],
    },
  }),
  blocks: {
    type: "array",
    maxItems: 24,
    items: {
      anyOf: [
        metricBlock,
        vehicleBlock,
        alertBlock,
        timelineBlock,
        confirmationBlock,
        receiptBlock,
        emptyBlock,
      ],
    },
  },
  followUps: {
    type: "array",
    maxItems: 12,
    items: { anyOf: [replyAction, navigateAction] },
  },
  provenance: strictObject({
    asOf: { type: "string", minLength: 1, maxLength: 80 },
    sources: { type: "array", maxItems: DETAIL_MAX_ITEMS, items: source },
    truncated: { type: "boolean" },
  }),
});

export const MODEL_TURN_FORMAT = {
  type: "json_schema",
  name: "salam_motors_assistant_turn_v1",
  strict: true,
  schema: MODEL_TURN_SCHEMA,
} as const;

