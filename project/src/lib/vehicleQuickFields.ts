import { VEHICLE_CATEGORIES, FUEL_TYPES } from "./constants";

export type VehicleQuickFieldType = "text" | "number" | "select";

export interface VehicleQuickFieldDef {
  key: string;
  labelKey: string;
  type: VehicleQuickFieldType;
  options?: string[];
}

// Shared between the mobile and desktop "Update Vehicle" quick-field-update tools so the
// two surfaces can't drift. Deliberately excludes registration/chassis/engine numbers
// (identity-sensitive, need uniqueness checks) and purchase/seller data (lives in a
// different table) — those stay full-form-only territory (AddVehicle/edit-vehicle form).
export const VEHICLE_QUICK_FIELDS: VehicleQuickFieldDef[] = [
  { key: "category", labelKey: "vehicleForm.category", type: "select", options: VEHICLE_CATEGORIES },
  { key: "manufacturer", labelKey: "vehicleForm.manufacturer", type: "text" },
  { key: "model", labelKey: "vehicleForm.model", type: "text" },
  { key: "fuel_type", labelKey: "vehicleForm.fuelType", type: "select", options: FUEL_TYPES },
  { key: "colour", labelKey: "vehicleForm.colour", type: "text" },
  { key: "manufacture_year", labelKey: "vehicleForm.year", type: "number" },
  { key: "odometer", labelKey: "vehicleForm.odometer", type: "number" },
  { key: "asking_price", labelKey: "vehicleForm.askingPrice", type: "number" },
  { key: "minimum_price", labelKey: "vehicleForm.minimumPrice", type: "number" },
  { key: "current_location", labelKey: "mobileUpdateVehicle.currentLocation", type: "text" },
];
