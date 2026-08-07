import { buildAdCreative } from "./creative.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const base = {
  manufacturer: "Toyota",
  brand: null,
  model: "Corolla",
  variant: "GLi",
  manufacture_year: 2019,
  asking_price: 650000,
  fuel_type: "Petrol",
  odometer: 42000,
  registration_state: "KA",
  photo_url: "https://example.test/photo.jpg",
};

Deno.test("buildAdCreative composes title from year/brand/model/variant", () => {
  const creative = buildAdCreative(base);
  assert(creative.title === "2019 Toyota Corolla GLi", `unexpected title: ${creative.title}`);
  assert(creative.template_version.length > 0, "template_version must be set so the template can be swapped later");
  assert(creative.photo_url === base.photo_url, "photo_url should pass through");
});

Deno.test("buildAdCreative prefers brand over manufacturer when brand is set", () => {
  const creative = buildAdCreative({ ...base, brand: "Toyota (Certified)" });
  assert(creative.title.includes("Toyota (Certified)"), `title should use brand: ${creative.title}`);
});

Deno.test("buildAdCreative falls back to 'Price on request' when asking_price is null or zero", () => {
  const noPrice = buildAdCreative({ ...base, asking_price: null });
  assert(noPrice.description.includes("Price on request"), noPrice.description);
  const zeroPrice = buildAdCreative({ ...base, asking_price: 0 });
  assert(zeroPrice.description.includes("Price on request"), zeroPrice.description);
});

Deno.test("buildAdCreative formats price in INR with grouping", () => {
  const creative = buildAdCreative(base);
  assert(creative.description.includes("₹6,50,000"), creative.description);
});

Deno.test("buildAdCreative never throws on minimal input (no variant, no year, no odometer)", () => {
  const creative = buildAdCreative({
    manufacturer: "Maruti",
    brand: null,
    model: "Alto",
    variant: null,
    manufacture_year: null,
    asking_price: null,
    fuel_type: "Petrol",
    odometer: null,
    registration_state: null,
    photo_url: null,
  });
  assert(creative.title === "Maruti Alto", `unexpected fallback title: ${creative.title}`);
  assert(creative.photo_url === null, "photo_url should stay null when absent");
});
