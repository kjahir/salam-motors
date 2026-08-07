import { describe, expect, it } from "vitest";
import { canAccessMobileTab, canAccessPage } from "./permissions";

describe("assistant navigation permission mirror", () => {
  it("keeps finance and team screens behind their staff roles", () => {
    expect(canAccessPage("accountant", "finance")).toBe(true);
    expect(canAccessPage("sales_executive", "finance")).toBe(false);
    expect(canAccessPage("manager", "team")).toBe(true);
    expect(canAccessPage("mechanic_inspector", "team")).toBe(false);
  });

  it("does not expose protected mobile tabs to unauthorized roles", () => {
    expect(canAccessMobileTab("sales_executive", "add-vehicle")).toBe(true);
    expect(canAccessMobileTab("mechanic_inspector", "add-vehicle")).toBe(false);
    expect(canAccessMobileTab("accountant", "reports")).toBe(true);
  });
});
