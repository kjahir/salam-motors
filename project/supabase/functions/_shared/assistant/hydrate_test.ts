import { hydrateBlocks } from "./hydrate.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const vehicleRow = {
  id: "v_1",
  stock_number: "SM-0412",
  registration_number: "KA01AB1234",
  manufacturer: "Maruti Suzuki",
  model: "Swift",
  variant: "VXi",
  current_status: "PURCHASED",
  manufacture_year: 2019,
  fuel_type: "Petrol",
  odometer: 48200,
  days_in_stock: 92,
  asking_price: 565000,
  minimum_price: 530000,
  financials: {
    total_vehicle_cost: 498000,
    estimated_profit: 67000,
    gross_profit: null,
  },
};

const rows = new Map<string, Record<string, unknown>>([
  ["vehicle:v_1", vehicleRow],
  ["alert:a_1", {
    id: "a_1",
    vehicle_id: "v_1",
    title: "Insurance expired",
    message: "Stored blurb",
    severity: "high",
    status: "open",
    created_at: "2026-08-01T00:00:00Z",
  }],
]);

Deno.test("vehicle items are filled from the tool row, not the model", () => {
  const { blocks, hydrated, dropped } = hydrateBlocks([{
    type: "vehicle_collection",
    title: "Ageing stock",
    items: [{ id: "v_1", explanation: "92 days, above market" }],
    shown: 1,
    total: 53,
  }], rows);

  assert(hydrated === 1 && dropped === 0, `hydrated=${hydrated} dropped=${dropped}`);
  const item = (blocks[0] as { items: Record<string, unknown>[] }).items[0];
  assert(item.stockNumber === "SM-0412", "stock number was not hydrated");
  assert(item.registrationNumber === "KA01AB1234", "registration was not hydrated");
  assert(item.askingPrice === 565000, "asking price was not hydrated");
  assert(item.daysInStock === 92, "days in stock was not hydrated");
  assert(item.status === "PURCHASED", "status was not mapped from current_status");
  assert(item.year === 2019, "year was not mapped from manufacture_year");
  // The one thing the model does contribute.
  assert(
    item.explanation === "92 days, above market",
    "the model's reasoning was lost",
  );
  assert((blocks[0] as { total: number }).total === 53, "total was altered");
});

Deno.test("finance columns come from the nested financials object", () => {
  const { blocks } = hydrateBlocks([{
    type: "vehicle_collection",
    items: [{ id: "v_1", explanation: null }],
    shown: 1,
    total: 1,
  }], rows);
  const item = (blocks[0] as { items: Record<string, unknown>[] }).items[0];
  assert(item.totalCost === 498000, "total cost was not read from financials");
  assert(item.estimatedProfit === 67000, "estimated profit was not read");
  assert(item.realisedProfit === null, "a null finance value was not preserved");
});

Deno.test("an id no tool returned is dropped, never rendered", () => {
  // The hallucination guard: the model cannot conjure a vehicle by naming one, because
  // there is no row to hydrate from. Previously it could emit 21 invented fields.
  const { blocks, hydrated, dropped } = hydrateBlocks([{
    type: "vehicle_collection",
    items: [
      { id: "v_1", explanation: "real" },
      { id: "v_does_not_exist", explanation: "invented" },
    ],
    shown: 2,
    total: 2,
  }], rows);

  assert(hydrated === 1, `expected 1 hydrated, got ${hydrated}`);
  assert(dropped === 1, `expected 1 dropped, got ${dropped}`);
  const block = blocks[0] as { items: unknown[]; shown: number };
  assert(block.items.length === 1, "the invented vehicle was rendered");
  assert(block.shown === 1, `shown must follow the drop, got ${block.shown}`);
});

Deno.test("alert explanation overrides the stored blurb, and falls back to it", () => {
  const { blocks } = hydrateBlocks([{
    type: "alert_list",
    items: [{ id: "a_1", explanation: "Blocks the sale this week" }],
  }], rows);
  const withReason = (blocks[0] as { items: Record<string, unknown>[] }).items[0];
  assert(
    withReason.message === "Blocks the sale this week",
    "the model's reason was discarded",
  );
  assert(withReason.severity === "high", "severity was not hydrated");

  const { blocks: bare } = hydrateBlocks([{
    type: "alert_list",
    items: [{ id: "a_1", explanation: null }],
  }], rows);
  const withoutReason = (bare[0] as { items: Record<string, unknown>[] }).items[0];
  assert(
    withoutReason.message === "Stored blurb",
    "the stored message was not used as a fallback",
  );
});

Deno.test("blocks without a hydrator pass through untouched", () => {
  const metric = {
    type: "metric_grid",
    title: "Totals",
    items: [{ label: "Unsold", value: 11, format: "number", tone: "neutral" }],
  };
  const { blocks, hydrated, dropped } = hydrateBlocks([metric], rows);
  assert(blocks[0] === metric, "a model-computed block was rewritten");
  assert(hydrated === 0 && dropped === 0, "counters moved for an untouched block");
});

Deno.test("hydration is a no-op when no tools ran", () => {
  const { blocks, dropped } = hydrateBlocks([{
    type: "vehicle_collection",
    items: [{ id: "v_1", explanation: "x" }],
    shown: 1,
    total: 1,
  }], new Map());
  const block = blocks[0] as { items: unknown[]; shown: number };
  assert(block.items.length === 0, "an item was hydrated from nowhere");
  assert(dropped === 1, "the unhydratable item was not counted");
  assert(block.shown === 0, "shown claimed items that are not there");
});
