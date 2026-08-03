import { withheldColumnNames, withholdIdentifiers } from "./redact-rows.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("identifiers are withheld from the model", () => {
  const result = withholdIdentifiers({
    ok: true,
    data: {
      vehicles: [{
        id: "v_1",
        stock_number: "SM-0412",
        registration_number: "KA01AB1234",
        manufacturer: "Maruti Suzuki",
      }],
    },
  });
  const serialized = JSON.stringify(result);
  assert(
    !serialized.includes("KA01AB1234"),
    "a registration number reached the model payload",
  );
  assert(serialized.includes("v_1"), "the id the model references was removed");
  assert(
    serialized.includes("SM-0412"),
    "stock number was removed; staff refer to vehicles by it, so the model needs it",
  );
});

Deno.test("party contact details are withheld at any nesting depth", () => {
  const result = withholdIdentifiers({
    data: {
      parties: [{
        id: "p_1",
        full_name: "Priya R",
        mobile: "9999999999",
        email: "priya@example.com",
        city: "Bengaluru",
        party_type: "customer",
      }],
      nested: { deeper: { rows: [{ mobile: "8888888888" }] } },
    },
  });
  const serialized = JSON.stringify(result);
  for (const leak of ["9999999999", "priya@example.com", "8888888888"]) {
    assert(!serialized.includes(leak), `${leak} reached the model payload`);
  }
  assert(serialized.includes("customer"), "a reasoning field was removed");
});

Deno.test("search_parties can still tell two people apart", () => {
  // The tool exists to resolve a party before a purchase or sale proposal. Withholding
  // full_name would return {id, party_type} for both of these — no way to pick the right
  // one, and no way to confirm the choice back to the user. That breaks the tool rather
  // than tightening it, so name and city stay.
  const result = withholdIdentifiers({
    data: {
      parties: [
        { id: "p_1", full_name: "Priya R", city: "Bengaluru", mobile: "9999999999" },
        { id: "p_2", full_name: "Priya R", city: "Mysuru", mobile: "8888888888" },
      ],
    },
  });
  const serialized = JSON.stringify(result);
  assert(serialized.includes("Priya R"), "the disambiguating name was withheld");
  assert(
    serialized.includes("Bengaluru") && serialized.includes("Mysuru"),
    "the city that separates two same-named parties was withheld",
  );
  assert(!serialized.includes("9999999999"), "a contact number reached the model");
});

Deno.test("every reasoning field survives", () => {
  // The quiet failure this guards against: strip one of these and the model silently
  // answers the wrong question rather than erroring.
  const row = {
    id: "v_1",
    stock_number: "SM-0412",
    manufacturer: "Maruti Suzuki",
    model: "Swift",
    variant: "VXi",
    current_status: "PURCHASED",
    manufacture_year: 2019,
    fuel_type: "Diesel",
    odometer: 48200,
    days_in_stock: 92,
    asking_price: 565000,
    minimum_price: 530000,
    category: "hatchback",
    onboarded_at: "2026-05-03T00:00:00Z",
    financials: {
      total_vehicle_cost: 498000,
      estimated_profit: 67000,
      gross_profit: null,
    },
  };
  const kept = withholdIdentifiers(row) as Record<string, unknown>;
  for (const key of Object.keys(row)) {
    assert(key in kept, `reasoning field ${key} was withheld`);
  }
  assert(
    (kept.financials as Record<string, unknown>).estimated_profit === 67000,
    "nested finance values were altered",
  );
});

Deno.test("withholding does not mutate the server's own copy", () => {
  // hydrate.ts fills the rendered block from the untrimmed row, so mutating in place would
  // silently blank the registration number in the UI too.
  const row = { id: "v_1", registration_number: "KA01AB1234" };
  withholdIdentifiers({ vehicles: [row] });
  assert(
    row.registration_number === "KA01AB1234",
    "the source row was mutated; the UI would lose the field as well",
  );
});

Deno.test("arrays, nulls and primitives pass through", () => {
  assert(withholdIdentifiers(null) === null, "null was altered");
  assert(withholdIdentifiers(42) === 42, "a number was altered");
  assert(withholdIdentifiers("text") === "text", "a string was altered");
  const list = withholdIdentifiers([{ id: "a", mobile: "1" }, { id: "b" }]);
  assert(Array.isArray(list) && list.length === 2, "array shape changed");
  assert(!JSON.stringify(list).includes('"mobile"'), "mobile survived in an array");
});

Deno.test("the withheld list is reportable for the trace", () => {
  const names = withheldColumnNames();
  assert(names.includes("registration_number"), "list is missing a known identifier");
  assert(names.includes("mobile"), "list is missing a known identifier");
  assert(
    names.join(",") === [...names].sort().join(","),
    "list must be stable/sorted so trace diffs are readable",
  );
});
