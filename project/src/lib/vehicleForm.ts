import type { VehicleCoreFormData } from "@/components/VehicleFormFields";

/**
 * Registration numbers are stored uppercase, always. An Indian plate has no lowercase form,
 * and mixed case makes the same vehicle look like two ("tn22ab1234" vs "TN22AB1234") to the
 * unique index and to `check_registration_available()`, both of which compare exactly.
 * Applied on input (so the dealer sees what will be stored) and again at every write.
 */
export const normalizeRegistration = (value: string): string => value.toUpperCase();

/**
 * Manufacturer and model are stored uppercase, always, for the same reason as
 * `normalizeRegistration`: "Honda"/"HONDA"/"honda" would otherwise sit as three different
 * strings in search, grouping, and the inventory list, purely because of how each dealer
 * happened to type it in. Applied on input and again at every write.
 */
export const normalizeUpperCase = (value: string): string => value.toUpperCase();

/** Vehicle identity + seller + purchase, i.e. everything captured when onboarding a vehicle. */
export interface VehicleFullFormData extends VehicleCoreFormData {
  seller_party_id: string;
  purchase_price: string;
  broker_commission: string;
  other_fee: string;
  payment_method: string;
  payment_reference: string;
  handover_location: string;
  odometer_at_purchase: string;
  keys_received: boolean;
  documents_received: boolean;
  notes: string;
}

export const emptyVehicleForm = (): VehicleFullFormData => ({
  registration_number: "",
  category: "Motorcycle",
  manufacturer: "",
  brand: "",
  model: "",
  variant: "",
  fuel_type: "Petrol",
  colour: "",
  manufacture_year: String(new Date().getFullYear() - 2),
  registration_date: "",
  chassis_number: "",
  engine_number: "",
  odometer: "",
  owner_count: "1",
  registration_city: "",
  registration_state: "",
  current_location: "Central Yard",
  asking_price: "",
  minimum_price: "",
  seller_party_id: "",
  purchase_price: "",
  broker_commission: "0",
  other_fee: "0",
  payment_method: "UPI",
  payment_reference: "",
  handover_location: "",
  odometer_at_purchase: "",
  keys_received: true,
  documents_received: false,
  notes: "",
});
