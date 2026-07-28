import { assistantStrings, formatMoney, interpolate } from "./locales.ts";
import type {
  ActionDisplayChange,
  ActionType,
  AssistantPrincipal,
  AssistantRisk,
  AssistantRole,
} from "./types.ts";
import {
  asRecord,
  isRecord,
  isUuid,
  nullableString,
  requiredNumber,
  requiredString,
} from "./validation.ts";

export type JsonSchema = Record<string, unknown>;

export interface ParsedProposal {
  arguments: Record<string, unknown>;
  targetType: string | null;
  targetId: string | null;
  summary: string;
  changes: ActionDisplayChange[];
}

export interface ActionSpec {
  actionType: ActionType;
  toolName: string;
  title: string;
  risk: AssistantRisk;
  roles: readonly AssistantRole[];
  parameters: JsonSchema;
  parse: (
    value: unknown,
    principal: AssistantPrincipal,
    locale: string,
  ) => ParsedProposal;
}

const uuidSchema: JsonSchema = {
  type: "string",
  pattern:
    "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
};
const nullableText = (maximum = 1_000): JsonSchema => ({
  type: ["string", "null"],
  maxLength: maximum,
});
const nullableNumber = (minimum = 0): JsonSchema => ({
  type: ["number", "null"],
  minimum,
  maximum: 999_999_999,
});

function objectSchema(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function nullableObject(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    anyOf: [
      objectSchema(properties),
      { type: "null" },
    ],
  };
}

function requiredUuid(
  object: Record<string, unknown>,
  key: string,
): string {
  const value = requiredString(object, key, 64);
  if (!isUuid(value)) throw new Error(`${key} must be a UUID`);
  return value;
}

function nullableFiniteNumber(
  object: Record<string, unknown>,
  key: string,
  minimum = 0,
): number | null {
  if (object[key] === null) return null;
  return requiredNumber(object, key, minimum, 999_999_999);
}

function nullableInteger(
  object: Record<string, unknown>,
  key: string,
  minimum = 0,
  maximum = 10_000_000,
): number | null {
  if (object[key] === null) return null;
  const value = requiredNumber(object, key, minimum, maximum);
  if (!Number.isInteger(value)) throw new Error(`${key} must be an integer`);
  return value;
}

function requiredBoolean(
  object: Record<string, unknown>,
  key: string,
): boolean {
  if (typeof object[key] !== "boolean") {
    throw new Error(`${key} must be a boolean`);
  }
  return object[key] as boolean;
}

function enumString(
  object: Record<string, unknown>,
  key: string,
  values: readonly string[],
): string {
  const value = requiredString(object, key, 100);
  if (!values.includes(value)) throw new Error(`${key} is not supported`);
  return value;
}

function money(value: unknown, locale: string): string {
  return formatMoney(Number(value), locale);
}

/** User-facing (localized) title for an action type — distinct from
 * ActionSpec.title, which stays English as tool-description metadata sent
 * to the model. */
export function actionTitle(actionType: ActionType, locale: string): string {
  const strings = assistantStrings(locale);
  return actionType === "vehicle.create_with_purchase"
    ? strings.onboardPurchasedVehicleTitle
    : strings.completeVehicleSaleTitle;
}

const vehicleProperties: Record<string, JsonSchema> = {
  registration_number: { type: "string", minLength: 1, maxLength: 40 },
  category: { type: "string", minLength: 1, maxLength: 80 },
  manufacturer: { type: "string", minLength: 1, maxLength: 120 },
  brand: nullableText(120),
  model: { type: "string", minLength: 1, maxLength: 120 },
  variant: nullableText(120),
  fuel_type: { type: "string", minLength: 1, maxLength: 80 },
  colour: nullableText(80),
  manufacture_year: {
    type: ["integer", "null"],
    minimum: 1900,
    maximum: 2200,
  },
  registration_date: nullableText(40),
  chassis_number: nullableText(120),
  engine_number: nullableText(120),
  odometer: { type: ["integer", "null"], minimum: 0, maximum: 10_000_000 },
  owner_count: { type: "integer", minimum: 1, maximum: 100 },
  registration_city: nullableText(120),
  registration_state: nullableText(120),
  current_location: nullableText(200),
  asking_price: nullableNumber(),
  minimum_price: nullableNumber(),
  notes: nullableText(1_500),
};

const purchaseProperties: Record<string, JsonSchema> = {
  seller_party_id: uuidSchema,
  purchase_date: nullableText(40),
  agreed_price: {
    type: "number",
    exclusiveMinimum: 0,
    maximum: 999_999_999,
  },
  broker_commission: { type: "number", minimum: 0, maximum: 999_999_999 },
  other_fee: { type: "number", minimum: 0, maximum: 999_999_999 },
  handover_location: nullableText(300),
  odometer_at_purchase: {
    type: ["integer", "null"],
    minimum: 0,
    maximum: 10_000_000,
  },
  keys_received: { type: "boolean" },
  documents_received: { type: "boolean" },
  notes: nullableText(1_500),
};

const paymentProperties: Record<string, JsonSchema> = {
  amount: nullableNumber(),
  payment_method: { type: "string", minLength: 1, maxLength: 100 },
  reference: nullableText(240),
  paid_at: nullableText(40),
  notes: nullableText(1_000),
};

const listingProperties: Record<string, JsonSchema> = {
  asking_price: nullableNumber(),
  minimum_price: nullableNumber(),
  description: nullableText(1_500),
};

function parseVehicle(value: unknown): Record<string, unknown> {
  const object = asRecord(value);
  const askingPrice = nullableFiniteNumber(object, "asking_price");
  const minimumPrice = nullableFiniteNumber(object, "minimum_price");
  if (
    askingPrice !== null && minimumPrice !== null &&
    minimumPrice > askingPrice
  ) {
    throw new Error("minimum_price cannot exceed asking_price");
  }
  return {
    registration_number: requiredString(object, "registration_number", 40)
      .toUpperCase(),
    category: requiredString(object, "category", 80),
    manufacturer: requiredString(object, "manufacturer", 120),
    brand: nullableString(object, "brand", 120),
    model: requiredString(object, "model", 120),
    variant: nullableString(object, "variant", 120),
    fuel_type: requiredString(object, "fuel_type", 80),
    colour: nullableString(object, "colour", 80),
    manufacture_year: nullableInteger(object, "manufacture_year", 1900, 2200),
    registration_date: nullableString(object, "registration_date", 40),
    chassis_number: nullableString(object, "chassis_number", 120),
    engine_number: nullableString(object, "engine_number", 120),
    odometer: nullableInteger(object, "odometer"),
    owner_count: nullableInteger(object, "owner_count", 1, 100) ?? 1,
    registration_city: nullableString(object, "registration_city", 120),
    registration_state: nullableString(object, "registration_state", 120),
    current_location: nullableString(object, "current_location", 200),
    asking_price: askingPrice,
    minimum_price: minimumPrice,
    notes: nullableString(object, "notes", 1_500),
  };
}

function parsePurchase(value: unknown): Record<string, unknown> {
  const object = asRecord(value);
  return {
    seller_party_id: requiredUuid(object, "seller_party_id"),
    purchase_date: nullableString(object, "purchase_date", 40),
    agreed_price: requiredNumber(object, "agreed_price", 0.01, 999_999_999),
    broker_commission: requiredNumber(
      object,
      "broker_commission",
      0,
      999_999_999,
    ),
    other_fee: requiredNumber(object, "other_fee", 0, 999_999_999),
    handover_location: nullableString(object, "handover_location", 300),
    odometer_at_purchase: nullableInteger(
      object,
      "odometer_at_purchase",
    ),
    keys_received: requiredBoolean(object, "keys_received"),
    documents_received: requiredBoolean(object, "documents_received"),
    notes: nullableString(object, "notes", 1_500),
  };
}

function parsePayment(value: unknown): Record<string, unknown> {
  const object = asRecord(value);
  return {
    amount: nullableFiniteNumber(object, "amount"),
    payment_method: requiredString(object, "payment_method", 100),
    reference: nullableString(object, "reference", 240),
    proof_urls: [],
    paid_at: nullableString(object, "paid_at", 40),
    notes: nullableString(object, "notes", 1_000),
  };
}

function parseListing(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  const object = asRecord(value);
  const askingPrice = nullableFiniteNumber(object, "asking_price");
  const minimumPrice = nullableFiniteNumber(object, "minimum_price");
  if (
    askingPrice !== null && minimumPrice !== null &&
    minimumPrice > askingPrice
  ) {
    throw new Error("listing minimum_price cannot exceed asking_price");
  }
  return {
    asking_price: askingPrice,
    minimum_price: minimumPrice,
    description: nullableString(object, "description", 1_500),
  };
}

const CREATE_VEHICLE: ActionSpec = {
  actionType: "vehicle.create_with_purchase",
  toolName: "propose_create_vehicle_with_purchase",
  title: "Onboard purchased vehicle",
  risk: "high",
  roles: ["owner", "manager"],
  parameters: objectSchema({
    vehicle: objectSchema(vehicleProperties),
    purchase: objectSchema(purchaseProperties),
    payment: objectSchema(paymentProperties),
    listing: nullableObject(listingProperties),
  }),
  parse(value, principal, locale) {
    const object = asRecord(value);
    const vehicle = parseVehicle(object.vehicle);
    const purchase = parsePurchase(object.purchase);
    const payment = parsePayment(object.payment);
    const listing = parseListing(object.listing);
    const argumentsValue = {
      org_id: principal.orgId,
      vehicle,
      purchase,
      payment,
      listing,
    };
    const vehicleLabel =
      `${vehicle.manufacturer} ${vehicle.model} (${vehicle.registration_number})`;
    const total = Number(purchase.agreed_price) +
      Number(purchase.broker_commission) + Number(purchase.other_fee);
    const strings = assistantStrings(locale);
    return {
      arguments: argumentsValue,
      targetType: null,
      targetId: null,
      summary: interpolate(strings.createVehicleSummary, {
        vehicle: vehicleLabel,
        listing: listing ? strings.draftListingWord : strings.noListingWord,
      }),
      changes: [
        { label: strings.vehicleLabel, to: vehicleLabel },
        { label: strings.purchaseTotalLabel, to: money(total, locale) },
        {
          label: strings.askingPriceLabel,
          to: vehicle.asking_price === null
            ? strings.notSetValue
            : money(vehicle.asking_price, locale),
        },
      ],
    };
  },
};

const saleProperties: Record<string, JsonSchema> = {
  buyer_party_id: uuidSchema,
  sale_date: nullableText(40),
  sale_price: {
    type: "number",
    exclusiveMinimum: 0,
    maximum: 999_999_999,
  },
  discount: { type: "number", minimum: 0, maximum: 999_999_999 },
  buyer_charges: { type: "number", minimum: 0, maximum: 999_999_999 },
  payment_status: {
    type: "string",
    enum: ["Not paid", "Partially paid", "Paid", "Refunded", "Disputed"],
  },
  delivery_status: { type: "string", enum: ["Pending", "Delivered"] },
  delivery_location: nullableText(300),
  odometer_at_sale: {
    type: ["integer", "null"],
    minimum: 0,
    maximum: 10_000_000,
  },
  notes: nullableText(1_500),
  payment_method: { type: "string", minLength: 1, maxLength: 100 },
  payment_reference: nullableText(240),
  paid_at: nullableText(40),
  payment_notes: nullableText(1_000),
};

function parseSale(value: unknown): Record<string, unknown> {
  const object = asRecord(value);
  const salePrice = requiredNumber(
    object,
    "sale_price",
    0.01,
    999_999_999,
  );
  const discount = requiredNumber(object, "discount", 0, 999_999_999);
  const buyerCharges = requiredNumber(
    object,
    "buyer_charges",
    0,
    999_999_999,
  );
  if (salePrice + buyerCharges - discount <= 0) {
    throw new Error("net sale revenue must be positive");
  }
  return {
    buyer_party_id: requiredUuid(object, "buyer_party_id"),
    sale_date: nullableString(object, "sale_date", 40),
    sale_price: salePrice,
    discount,
    buyer_charges: buyerCharges,
    payment_status: enumString(object, "payment_status", [
      "Not paid",
      "Partially paid",
      "Paid",
      "Refunded",
      "Disputed",
    ]),
    delivery_status: enumString(object, "delivery_status", [
      "Pending",
      "Delivered",
    ]),
    delivery_location: nullableString(object, "delivery_location", 300),
    odometer_at_sale: nullableInteger(object, "odometer_at_sale"),
    notes: nullableString(object, "notes", 1_500),
    payment_method: requiredString(object, "payment_method", 100),
    payment_reference: nullableString(object, "payment_reference", 240),
    paid_at: nullableString(object, "paid_at", 40),
    payment_notes: nullableString(object, "payment_notes", 1_000),
  };
}

const COMPLETE_SALE: ActionSpec = {
  actionType: "vehicle.complete_sale",
  toolName: "propose_complete_vehicle_sale",
  title: "Complete vehicle sale",
  risk: "critical",
  roles: ["owner"],
  parameters: objectSchema({
    vehicle_id: uuidSchema,
    sale: objectSchema(saleProperties),
  }),
  parse(value, principal, locale) {
    const object = asRecord(value);
    const vehicleId = requiredUuid(object, "vehicle_id");
    const sale = parseSale(object.sale);
    const net = Number(sale.sale_price) + Number(sale.buyer_charges) -
      Number(sale.discount);
    const strings = assistantStrings(locale);
    return {
      arguments: {
        org_id: principal.orgId,
        vehicle_id: vehicleId,
        sale,
      },
      targetType: "vehicle",
      targetId: vehicleId,
      summary: strings.completeSaleSummary,
      changes: [
        { label: strings.vehicleIdLabel, to: vehicleId },
        { label: strings.netRevenueLabel, to: money(net, locale) },
        { label: strings.vehicleStatusLabel, from: "Current", to: "SOLD" },
      ],
    };
  },
};

export const ACTION_SPECS: readonly ActionSpec[] = [
  CREATE_VEHICLE,
  COMPLETE_SALE,
];

export function actionSpecByTool(name: string): ActionSpec | undefined {
  return ACTION_SPECS.find((spec) => spec.toolName === name);
}

export function actionSpecByType(type: ActionType): ActionSpec | undefined {
  return ACTION_SPECS.find((spec) => spec.actionType === type);
}

export function parseCanonicalProposalArguments(
  actionType: ActionType,
  value: unknown,
): {
  orgId: string;
  vehicleId: string | null;
  vehicle: Record<string, unknown> | null;
  purchase: Record<string, unknown> | null;
  payment: Record<string, unknown> | null;
  listing: Record<string, unknown> | null;
  sale: Record<string, unknown> | null;
} {
  const object = asRecord(value);
  const orgId = requiredString(object, "org_id", 64);
  if (!isUuid(orgId)) throw new Error("Stored organization is invalid");
  if (actionType === "vehicle.create_with_purchase") {
    return {
      orgId,
      vehicleId: null,
      vehicle: asRecord(object.vehicle),
      purchase: asRecord(object.purchase),
      payment: asRecord(object.payment),
      listing: object.listing === null
        ? null
        : isRecord(object.listing)
        ? object.listing
        : null,
      sale: null,
    };
  }
  const vehicleId = requiredUuid(object, "vehicle_id");
  return {
    orgId,
    vehicleId,
    vehicle: null,
    purchase: null,
    payment: null,
    listing: null,
    sale: asRecord(object.sale),
  };
}

