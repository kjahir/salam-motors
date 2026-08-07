// Placeholder ad creative template. The user explicitly left final visual
// design undecided - this is a clean, reasonable default (title + short
// spec/price description + a cover photo), deliberately factored into its
// own pure function with a `template_version` tag so the layout/copy can
// be swapped out later without touching the posting/queueing logic that
// calls it.

export interface AdCreativeInput {
  manufacturer: string;
  brand: string | null;
  model: string;
  variant: string | null;
  manufacture_year: number | null;
  asking_price: number | null;
  fuel_type: string;
  odometer: number | null;
  registration_state: string | null;
  photo_url: string | null;
}

export interface AdCreative {
  template_version: string;
  title: string;
  description: string;
  price: number | null;
  currency: "INR";
  photo_url: string | null;
  specs: {
    year: number | null;
    fuel_type: string;
    odometer_km: number | null;
    location: string | null;
  };
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function buildAdCreative(input: AdCreativeInput): AdCreative {
  const displayBrand = (input.brand ?? input.manufacturer).trim();
  const titleParts = [
    input.manufacture_year ? String(input.manufacture_year) : null,
    displayBrand,
    input.model.trim(),
    input.variant?.trim() || null,
  ].filter((part): part is string => Boolean(part));
  const title = titleParts.join(" ") || "Pre-owned vehicle";

  const specParts = [
    input.manufacture_year ? `${input.manufacture_year} model` : null,
    typeof input.odometer === "number" ? `${input.odometer.toLocaleString("en-IN")} km` : null,
    input.fuel_type || null,
    input.registration_state || null,
  ].filter((part): part is string => Boolean(part));

  const priceText = typeof input.asking_price === "number" && input.asking_price > 0
    ? formatInr(input.asking_price)
    : "Price on request";

  const description = `${title} — ${specParts.join(", ")}. ${priceText}. Verified pre-owned vehicle, listed on VahanExchange.`;

  return {
    template_version: "placeholder-card-v1",
    title,
    description,
    price: input.asking_price,
    currency: "INR",
    photo_url: input.photo_url,
    specs: {
      year: input.manufacture_year,
      fuel_type: input.fuel_type,
      odometer_km: input.odometer,
      location: input.registration_state,
    },
  };
}
