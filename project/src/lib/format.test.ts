import { describe, expect, it } from "vitest";
import { elapsedMilliseconds, formatDurationSeconds } from "./format";

describe("audit timing formatters", () => {
  it("formats milliseconds as seconds with useful precision", () => {
    expect(formatDurationSeconds(0)).toBe("0.000 s");
    expect(formatDurationSeconds(1250)).toBe("1.250 s");
    expect(formatDurationSeconds(61_234)).toBe("61.234 s");
  });

  it("calculates elapsed time between audit timestamps", () => {
    expect(
      elapsedMilliseconds(
        "2026-07-29T10:00:00.000Z",
        "2026-07-29T10:00:02.345Z",
      ),
    ).toBe(2345);
    expect(elapsedMilliseconds(null, "2026-07-29T10:00:02.345Z")).toBeNull();
  });
});
