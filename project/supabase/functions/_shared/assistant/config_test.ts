import { usableActionTokenSecret } from "./config.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("action tokens require a secret with at least 32 bytes", () => {
  assert(usableActionTokenSecret(undefined) === null, "missing secret");
  assert(usableActionTokenSecret("x".repeat(31)) === null, "short secret");
  assert(
    usableActionTokenSecret(`  ${"x".repeat(32)}  `) === "x".repeat(32),
    "valid secret should be trimmed and retained",
  );
  assert(
    usableActionTokenSecret("தமிழ்மொழிரகசியச்சொல்") !== null,
    "minimum length is measured in encoded bytes",
  );
});
