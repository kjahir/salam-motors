/**
 * The sale page's canonical set of named sections — Cost Sheet / Sale Projection / Record
 * Sale before a sale exists, Sale Completed / Profit Distribution after. Desktop (`SaleTab`
 * in pages/VehicleDetail.tsx) and mobile (mobile/MobileSaleContent.tsx) are separate
 * implementations by design (see CLAUDE.md), but both are expected to cover every section
 * here — each marks its coverage with a `sale-section:<key>` JSX comment next to the
 * section it renders. saleSections.test.ts greps both source files for every key and fails
 * if either is missing one, so a section added to one platform and forgotten on the other
 * fails a test instead of shipping silently absent.
 *
 * Not itself rendered from — this is a checklist expressed as code, not a driver for the UI.
 */
export const SALE_PAGE_SECTIONS = [
  "costSheet",
  "saleProjection",
  "recordSale",
  "saleCompleted",
  "profitDistribution",
] as const;

export type SalePageSection = (typeof SALE_PAGE_SECTIONS)[number];
