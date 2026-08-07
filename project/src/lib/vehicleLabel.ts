/**
 * How a vehicle is named in pickers, tables and reports.
 *
 * Staff recognise a bike by its registration plate, not by the internal stock number
 * (BIKE-2026-0000006), which nobody can recall or type. The stock number is still the
 * system's own identifier and stays on the vehicle's own pages — here it is only a
 * fallback for a vehicle whose registration has not been captured yet.
 */
interface VehicleLike {
  stock_number: string;
  registration_number?: string | null;
  manufacturer?: string | null;
  model?: string | null;
}

/** Short identifier for a table cell: the registration plate where there is one. */
export function vehicleRef(v: VehicleLike | null | undefined): string {
  if (!v) return "";
  return v.registration_number?.trim() || v.stock_number;
}

/** Identifier plus make/model, for dropdown options and list rows. */
export function vehicleLabel(v: VehicleLike | null | undefined): string {
  if (!v) return "";
  const name = [v.manufacturer, v.model].filter(Boolean).join(" ");
  return name ? `${vehicleRef(v)} · ${name}` : vehicleRef(v);
}
