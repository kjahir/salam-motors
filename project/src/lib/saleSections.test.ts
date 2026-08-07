import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SALE_PAGE_SECTIONS } from "./saleSections";

// A static text check, not a render test: each platform's sale-page source is expected to
// contain a `sale-section:<key>` marker comment for every section in SALE_PAGE_SECTIONS.
// Rendering these components needs heavy mocking (Supabase, auth, i18n, entitlements) for
// no real benefit here — the thing being caught is "a section exists on one platform and
// was never added to the other," which a source-level check answers just as well.
const PLATFORM_FILES: { name: string; path: string }[] = [
  { name: "desktop (VehicleDetail.tsx SaleTab)", path: "../pages/VehicleDetail.tsx" },
  { name: "mobile (MobileSaleContent.tsx)", path: "../mobile/MobileSaleContent.tsx" },
];

describe("sale page section coverage", () => {
  it.each(PLATFORM_FILES)("$name covers every SALE_PAGE_SECTIONS entry", ({ path }) => {
    const source = readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
    const missing = SALE_PAGE_SECTIONS.filter((section) => !source.includes(`sale-section:${section}`));
    expect(missing).toEqual([]);
  });
});
