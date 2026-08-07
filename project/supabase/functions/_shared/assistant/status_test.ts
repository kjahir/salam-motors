import { toolResultStatus, toolStatus } from "./status.ts";
import { CAPABILITIES } from "./capabilities.ts";
import type { ToolEntity } from "./types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const noEvidence = new Map<string, ToolEntity>();

Deno.test("every capability has a status of its own", () => {
  const generic = toolStatus("no_such_tool", {}, noEvidence).key;
  for (const capability of CAPABILITIES) {
    const status = toolStatus(capability.toolName, {}, noEvidence);
    assert(
      status.key !== generic,
      `${capability.toolName} falls back to the generic status`,
    );
  }
});

Deno.test("a searched-for phrase is quoted back, clamped to one line", () => {
  const short = toolStatus("search_inventory", { query: "Swift" }, noEvidence);
  assert(short.key === "assistant.status.tool.inventoryQuery", "wrong key");
  assert(short.params?.query === "Swift", "query was not carried through");

  const long = toolStatus(
    "search_inventory",
    { query: "a".repeat(120) },
    noEvidence,
  );
  const shown = String(long.params?.query ?? "");
  assert(shown.length <= 32, `status param was not clamped: ${shown.length}`);
  assert(shown.endsWith("…"), "a clamped param should show it was cut");
});

Deno.test("a vehicle is named only once its label has been seen", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const unknown = toolStatus("get_vehicle_360", { vehicle_id: id }, noEvidence);
  assert(unknown.key === "assistant.status.tool.vehicle", "wrong key");
  assert(unknown.params === undefined, "an unseen id must not become a param");

  const evidence = new Map<string, ToolEntity>([
    [`vehicle:${id}`, { type: "vehicle", id, label: "KA01AB1234 Swift VXI" }],
  ]);
  const known = toolStatus("get_vehicle_360", { vehicle_id: id }, evidence);
  assert(known.key === "assistant.status.tool.vehicleNamed", "wrong key");
  assert(
    known.params?.vehicle === "KA01AB1234 Swift VXI",
    "the seen label should be shown instead of the id",
  );
  assert(
    !JSON.stringify(known.params).includes(id),
    "a status must never carry a raw identifier",
  );
});

Deno.test("malformed arguments degrade the status instead of throwing", () => {
  for (const raw of [null, undefined, "not-an-object", [], { query: 42 }]) {
    const status = toolStatus("search_inventory", raw, noEvidence);
    assert(status.key === "assistant.status.tool.inventory", "wrong fallback");
  }
});

Deno.test("record type picks the wording, unknown types stay general", () => {
  const documents = toolStatus(
    "get_operational_records",
    { record_type: "documents" },
    noEvidence,
  );
  assert(documents.key === "assistant.status.tool.documents", "wrong key");
  const all = toolStatus(
    "get_operational_records",
    { record_type: "all" },
    noEvidence,
  );
  assert(all.key === "assistant.status.tool.records", "wrong key");
});

Deno.test("only row-per-entity searches report a count", () => {
  const rows = {
    ok: true as const,
    data: {},
    entities: [
      { type: "vehicle", id: "a", label: "A" },
      { type: "vehicle", id: "b", label: "B" },
    ],
  };
  const counted = toolResultStatus("search_inventory", rows);
  assert(counted?.key === "assistant.status.tool.found", "wrong key");
  assert(counted?.params?.count === 2, "count should match the entities");

  assert(
    toolResultStatus("search_inventory", { ...rows, entities: [] })?.key ===
      "assistant.status.tool.foundNone",
    "an empty result should say so",
  );
  // Alerts mix vehicles into their entities, so a count there would misstate the result.
  assert(
    toolResultStatus("get_alerts_compliance", rows) === null,
    "alerts must not report a row count",
  );
  assert(
    toolResultStatus("search_inventory", {
      ok: false,
      error: { code: "NOT_FOUND", message: "no" },
    }) === null,
    "a failed tool has nothing to report",
  );
});
