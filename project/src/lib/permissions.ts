import type { Role } from "./types";
import type { PageKey } from "@/components/Layout";
import type { MobileScreen } from "@/mobile/MobileApp";

/**
 * UX-only mirror of the RLS role matrix (see
 * supabase/migrations/20260727110000_role_based_rls_cutover.sql for the
 * real, enforced version). Hiding a nav item or button here does not grant
 * or restrict anything on its own - the database policies are what
 * actually gate reads/writes. Keep this in sync with that migration when
 * either changes.
 *
 * `null` in PAGE_ACCESS means every active role can see that page.
 */
export const PAGE_ACCESS: Partial<Record<PageKey, Role[]>> = {
  "add-vehicle": ["owner", "manager", "sales_executive"],
  partners: ["owner", "manager", "accountant"],
  finance: ["owner", "manager", "accountant"],
  team: ["owner", "manager"],
  audit: ["owner", "manager"],
};

export const MOBILE_TAB_ACCESS: Partial<Record<MobileScreen, Role[]>> = {
  "add-vehicle": ["owner", "manager", "sales_executive"],
  reports: ["owner", "manager", "accountant"],
};

export function canAccessPage(role: Role | null, page: PageKey): boolean {
  const allowed = PAGE_ACCESS[page];
  if (!allowed) return true;
  if (!role) return false;
  return allowed.includes(role);
}

export function canAccessMobileTab(role: Role | null, screen: MobileScreen): boolean {
  const allowed = MOBILE_TAB_ACCESS[screen];
  if (!allowed) return true;
  if (!role) return false;
  return allowed.includes(role);
}
