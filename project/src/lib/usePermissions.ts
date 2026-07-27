import { useAuth } from "./useAuth";
import { canAccessPage, canAccessMobileTab } from "./permissions";
import type { PageKey } from "@/components/Layout";
import type { MobileScreen } from "@/mobile/MobileApp";

/**
 * UX-only permission check for the currently signed-in staff member.
 * Not a security boundary - see permissions.ts for why.
 */
export function usePermissions() {
  const { role } = useAuth();
  return {
    role,
    canAccessPage: (page: PageKey) => canAccessPage(role, page),
    canAccessMobileTab: (screen: MobileScreen) => canAccessMobileTab(role, screen),
  };
}
