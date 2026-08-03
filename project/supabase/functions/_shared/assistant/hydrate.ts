/**
 * Fills block items from the tool rows the server already holds.
 *
 * The model names rows by id and says why they matter; every fact comes from here. That
 * removes the largest single cost in a turn — retyping ~21 fields per vehicle, roughly
 * 2,300 output tokens for twenty of them — and removes a hallucination class with it: a
 * price the model never writes is a price it cannot get wrong.
 *
 * An id with no matching row is dropped. `groundProvenance` already treats unknown sources
 * that way, and the alternative is rendering a card for a vehicle that does not exist.
 */

type Row = Record<string, unknown>;

function str(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value ? value : null;
}

function num(row: Row, key: string): number | null {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** Finance columns arrive nested under `financials` when the caller may see them. */
function finance(row: Row, key: string): number | null {
  const nested = row.financials;
  if (typeof nested !== "object" || nested === null) return null;
  return num(nested as Row, key);
}

function hydrateVehicle(row: Row, explanation: string | null): Row {
  return {
    id: row.id,
    stockNumber: str(row, "stock_number") ?? String(row.id ?? ""),
    registrationNumber: str(row, "registration_number"),
    manufacturer: str(row, "manufacturer") ?? "",
    model: str(row, "model") ?? "",
    variant: str(row, "variant"),
    status: str(row, "current_status") ?? "",
    year: num(row, "manufacture_year"),
    fuelType: str(row, "fuel_type"),
    odometer: num(row, "odometer"),
    daysInStock: num(row, "days_in_stock"),
    askingPrice: num(row, "asking_price"),
    minimumPrice: num(row, "minimum_price"),
    totalCost: finance(row, "total_vehicle_cost"),
    estimatedProfit: finance(row, "estimated_profit"),
    realisedProfit: finance(row, "gross_profit"),
    alertCount: num(row, "alert_count") ?? 0,
    complianceCount: num(row, "compliance_count") ?? 0,
    complianceSeverity: str(row, "compliance_severity"),
    explanation,
    // Navigation is derived, not model-authored: the renderer builds vehicle links itself.
    actions: [],
  };
}

function hydrateAlert(row: Row, explanation: string | null): Row {
  return {
    id: row.id,
    vehicleId: str(row, "vehicle_id"),
    title: str(row, "title") ?? "",
    // The model's reason for surfacing this alert is more useful than the stored blurb,
    // but the stored one is a sound fallback when it offered none.
    message: explanation ?? str(row, "message"),
    severity: str(row, "severity") ?? "",
    status: str(row, "status") ?? "",
    createdAt: str(row, "created_at"),
  };
}

const HYDRATORS: Record<
  string,
  { entity: string; build: (row: Row, explanation: string | null) => Row }
> = {
  vehicle_collection: { entity: "vehicle", build: hydrateVehicle },
  alert_list: { entity: "alert", build: hydrateAlert },
};

/**
 * Replaces `{id, explanation}` items with full rows. Blocks with no hydrator, and blocks
 * whose items are already full, pass through untouched.
 */
export function hydrateBlocks(
  blocks: readonly unknown[],
  rows: ReadonlyMap<string, Row>,
): { blocks: unknown[]; hydrated: number; dropped: number } {
  let hydrated = 0;
  let dropped = 0;

  const out = blocks.map((value) => {
    if (typeof value !== "object" || value === null) return value;
    const block = value as Row;
    const spec = typeof block.type === "string" ? HYDRATORS[block.type] : undefined;
    if (!spec || !Array.isArray(block.items)) return value;

    const items = (block.items as unknown[]).flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const record = item as Row;
      const id = typeof record.id === "string" ? record.id : null;
      if (!id) {
        dropped += 1;
        return [];
      }
      const row = rows.get(`${spec.entity}:${id}`);
      if (!row) {
        dropped += 1;
        return [];
      }
      hydrated += 1;
      const explanation = typeof record.explanation === "string" &&
          record.explanation
        ? record.explanation
        : null;
      return [spec.build(row, explanation)];
    });

    // `shown` must describe what the user can actually see, so it follows the drops.
    const shown = typeof block.shown === "number"
      ? Math.min(block.shown, items.length)
      : items.length;
    return "shown" in block
      ? { ...block, items, shown }
      : { ...block, items };
  });

  return { blocks: out, hydrated, dropped };
}
