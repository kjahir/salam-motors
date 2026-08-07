/* eslint-disable @typescript-eslint/no-explicit-any -- asserting on raw JSON Schema shapes, which are untyped by nature. */
import {
  MODEL_TURN_FORMAT,
  MODEL_TURN_FORMATS,
  turnFormatForIntent,
} from "./schemas.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// deno-lint-ignore no-explicit-any
function blockTypes(format: { schema: any }): string[] {
  const items = format.schema.properties.blocks.items;
  const variants = items.anyOf ?? [items];
  // deno-lint-ignore no-explicit-any
  return variants.map((block: any) => block.properties.type.enum[0]).sort();
}

Deno.test("an unknown or absent intent gets the full union", () => {
  // Every turn without a prefetch must behave exactly as it did before variants existed.
  assert(turnFormatForIntent(null) === MODEL_TURN_FORMAT, "null intent narrowed the schema");
  assert(
    turnFormatForIntent("something_new") === MODEL_TURN_FORMAT,
    "an unmapped intent narrowed the schema",
  );
  assert(blockTypes(MODEL_TURN_FORMAT).length === 7, "the full union lost a block type");
});

Deno.test("variants narrow blocks and nothing else", () => {
  // The safety property: a turn produced under a variant is still a valid instance of the
  // full schema, so parseAssistantTurn and the block renderer need no change.
  // deno-lint-ignore no-explicit-any
  const full = MODEL_TURN_FORMAT.schema as any;
  for (const [key, format] of Object.entries(MODEL_TURN_FORMATS)) {
    if (key === "full") continue;
    // deno-lint-ignore no-explicit-any
    const schema = format.schema as any;
    assert(
      JSON.stringify(Object.keys(schema.properties)) ===
        JSON.stringify(Object.keys(full.properties)),
      `${key} changed the envelope shape`,
    );
    assert(
      JSON.stringify(schema.properties.answer) ===
        JSON.stringify(full.properties.answer),
      `${key} constrained answer.text; prose must never be narrowed`,
    );
    assert(
      JSON.stringify(schema.properties.provenance) ===
        JSON.stringify(full.properties.provenance),
      `${key} altered provenance`,
    );
  }
});

Deno.test("every variant keeps an escape hatch and is smaller than the full union", () => {
  for (const [key, format] of Object.entries(MODEL_TURN_FORMATS)) {
    if (key === "full") continue;
    const types = blockTypes(format);
    assert(
      types.includes("empty_state"),
      `${key} has no empty_state, leaving no legal way to say "nothing here"`,
    );
    assert(
      types.length < 7,
      `${key} narrows nothing, so it buys no decoding saving`,
    );
    assert(
      JSON.stringify(format.schema).length <
        JSON.stringify(MODEL_TURN_FORMAT.schema).length,
      `${key} is not actually smaller than the full schema`,
    );
  }
});

Deno.test("intents map to the block type they are about", () => {
  assert(
    blockTypes(turnFormatForIntent("inventory_listing")).includes(
      "vehicle_collection",
    ),
    "an inventory question cannot render vehicles",
  );
  assert(
    blockTypes(turnFormatForIntent("compliance_alerts")).includes("alert_list"),
    "an alerts question cannot render alerts",
  );
  assert(
    blockTypes(turnFormatForIntent("ageing_stock")).includes("metric_grid"),
    "an ageing question cannot render its summary metrics",
  );
});

Deno.test("variant names are distinct so grammars are cached separately", () => {
  const names = Object.values(MODEL_TURN_FORMATS).map((format) => format.name);
  assert(
    new Set(names).size === names.length,
    `duplicate schema names: ${names.join(", ")}`,
  );
});

Deno.test("every prefetch intent has a format, or falls back deliberately", () => {
  // Guards the seam between prefetch.ts and this module: a new intent that nobody mapped
  // gets the full union rather than an accidental narrowing.
  for (const intent of ["inventory_listing", "ageing_stock", "compliance_alerts"]) {
    assert(
      turnFormatForIntent(intent) !== MODEL_TURN_FORMAT,
      `${intent} is a known prefetch intent but still uses the full union`,
    );
  }
});
