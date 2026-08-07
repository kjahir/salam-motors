import {
  sha256Hex,
  signActionToken,
  verifyActionToken,
} from "./action-token.ts";
import type { ActionTokenPayload } from "./types.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const SECRET = "test-secret-at-least-32-bytes-long";

const payload: ActionTokenPayload = {
  version: 1,
  proposalId: "11111111-1111-4111-8111-111111111111",
  conversationId: "22222222-2222-4222-8222-222222222222",
  orgId: "33333333-3333-4333-8333-333333333333",
  userId: "44444444-4444-4444-8444-444444444444",
  actionType: "vehicle.create_with_purchase",
  argumentHash: "abc123",
  confirmationToken: "raw-confirmation-token-value",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

async function expectRejection(
  run: () => Promise<unknown>,
  message: string,
): Promise<void> {
  let rejected = false;
  try {
    await run();
  } catch {
    rejected = true;
  }
  assert(rejected, message);
}

Deno.test("action tokens round trip and preserve bound context", async () => {
  const token = await signActionToken(payload, SECRET);
  const verified = await verifyActionToken(
    token,
    SECRET,
    new Date("2030-01-01T00:00:00.000Z"),
  );
  assert(verified.userId === payload.userId, "user binding changed");
  assert(verified.orgId === payload.orgId, "org binding changed");
  assert(verified.actionType === payload.actionType, "action binding changed");
  assert(
    verified.argumentHash === payload.argumentHash,
    "argument hash changed",
  );
  assert(
    verified.confirmationToken === payload.confirmationToken,
    "confirmation token changed",
  );
});

Deno.test("action token tampering is rejected", async () => {
  const token = await signActionToken(payload, SECRET);
  const [body, signature] = token.split(".");
  await expectRejection(
    () =>
      verifyActionToken(
        `${body.slice(0, -1)}A.${signature}`,
        SECRET,
        new Date("2030-01-01T00:00:00.000Z"),
      ),
    "tampered token should be rejected",
  );
});

Deno.test("action token signed with a different secret is rejected", async () => {
  const token = await signActionToken(payload, "another-secret-32-bytes-long!!");
  await expectRejection(
    () => verifyActionToken(token, SECRET, new Date("2030-01-01T00:00:00.000Z")),
    "wrong-secret token should be rejected",
  );
});

Deno.test("expired action token is rejected", async () => {
  const token = await signActionToken(payload, SECRET);
  await expectRejection(
    () => verifyActionToken(token, SECRET, new Date("2099-01-01T00:00:00.001Z")),
    "expired token should be rejected",
  );
});

Deno.test("incomplete action token payload is rejected", async () => {
  const incomplete = {
    ...payload,
    confirmationToken: "",
  } as ActionTokenPayload;
  const token = await signActionToken(incomplete, SECRET);
  await expectRejection(
    () => verifyActionToken(token, SECRET, new Date("2030-01-01T00:00:00.000Z")),
    "incomplete payload should be rejected",
  );
});

Deno.test("stable argument hashes ignore object key insertion order", async () => {
  const left = await sha256Hex({ amount: 100, vehicle_id: "v1" });
  const right = await sha256Hex({ vehicle_id: "v1", amount: 100 });
  assert(left === right, "canonical hash should be stable");
});
