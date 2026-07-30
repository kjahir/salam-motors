import type { VehicleCoreFormData } from "@/components/VehicleFormFields";

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
