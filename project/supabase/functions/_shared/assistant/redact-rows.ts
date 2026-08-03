/**
 * Decides which row columns the model is allowed to see.
 *
 * Every tool result is JSON-serialized into the model replay, so exposure is driven by each
 * tool's `select`, not by what the user asked: "which bike has more expense" shipped a
 * registration number for every vehicle scanned. This trims that at the boundary.
 *
 * It only works because of hydration (see hydrate.ts). Withholding a column from the model
 * does not withhold it from the user — the server still fills it into the rendered block
 * from its own copy of the row. Without hydration this would be a loss of information to
 * the user rather than a reduction in what leaves the building.
 *
 * ## What may be withheld, and what may not
 *
 * Pure identifiers are safe: the model needs a stable id to *reference* a row, not a
 * registration number to reason about ageing or price. Searching by one still works,
 * because tools filter server-side in Postgres before this point.
 *
 * Reasoning fields are not safe and are all kept. The model ranks, groups, filters and
 * explains using status, price, age, make/model/variant, fuel type, cost and profit. Drop
 * `variant` and it can no longer notice that three overpriced cars share one; drop
 * `fuel_type` and "which diesel bikes are ageing" silently returns the wrong set. That
 * failure is quiet — no error, just a worse answer — which is exactly why the list below is
 * a deny-list of identifiers rather than an allow-list of "useful" columns.
 */

/**
 * Columns withheld from the model. Identifiers it can reference by id instead, plus
 * bookkeeping nothing reasons over.
 */
const WITHHELD_COLUMNS: ReadonlySet<string> = new Set([
  /*
  Vehicle identifier. Stock number is kept instead: it is how staff refer to a vehicle in
  conversation, so the model needs it to write a sentence a human recognizes, and it
  disambiguates two otherwise identical cars. Searching by registration still works —
  tools filter on the column in Postgres before this point.
  */
  "registration_number",
  /*
  Contact details and government/financial identifiers: the fields that let someone be
  reached or identified outside this app. None of them help the model rank, filter or
  explain anything.

  `full_name` is deliberately NOT here. search_parties exists to resolve a party before a
  purchase or sale proposal, and a result of {id, party_type} gives the model no way to
  tell two matches apart or to confirm the right person back to the user. The name is the
  disambiguator; removing it breaks the tool rather than tightening it. Same for
  `city`/`state`, which separate two customers who share a name.
  */
  "mobile",
  "email",
  "address",
  "pincode",
  "gst_number",
  "pan_number",
  "aadhaar_number",
  "account_number",
  "ifsc",
  "upi_id",
  // Bookkeeping the model never reasons over.
  "org_id",
  "created_by",
  "updated_by",
  "deleted_at",
  "consent",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively removes withheld columns from a tool result payload.
 *
 * Depth-bounded rather than trusting the shape: tool results nest rows under `data`,
 * `vehicles`, `financials`, `alerts` and so on, and a missed level would silently leak.
 */
export function withholdIdentifiers<T>(value: T, depth = 0): T {
  if (depth > 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => withholdIdentifiers(item, depth + 1)) as T;
  }
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (WITHHELD_COLUMNS.has(key)) continue;
    out[key] = withholdIdentifiers(item, depth + 1);
  }
  return out as T;
}

/** Names of the columns this module withholds. Exported for the trace and for tests. */
export function withheldColumnNames(): string[] {
  return [...WITHHELD_COLUMNS].sort();
}
