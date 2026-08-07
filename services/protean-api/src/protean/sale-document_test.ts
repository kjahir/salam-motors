import { prepareSaleAgreement } from "./sale-document.ts";
import { ProteanHttpError } from "./http.ts";
import type { SupabaseClientLike } from "../auth.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const SALE_ID = "5a1e0000-0000-4000-8000-000000000001";
const VEHICLE_ID = "ee110000-0000-4000-8000-000000000002";
const ORG_ID = "0f611000-0000-4000-8000-000000000003";

const ROWS: Record<string, unknown> = {
  sales: {
    id: SALE_ID,
    vehicle_id: VEHICLE_ID,
    buyer_party_id: "b0110000-0000-4000-8000-000000000004",
    sale_date: "2026-08-01T00:00:00.000Z",
    sale_price: 485000,
    discount: 10000,
    buyer_charges: 5000,
    payment_status: "Paid",
    delivery_status: "Pending",
    delivery_location: "Yard",
    notes: null,
  },
  vehicles: {
    id: VEHICLE_ID,
    stock_number: "SM-0042",
    registration_number: "KA01AB1234",
    manufacturer: "Maruti Suzuki",
    model: "Swift",
    variant: "VXI",
    manufacture_year: 2019,
    odometer: 42180,
    chassis_number: "MA3EWDE1S00123456",
    engine_number: "K12MN1234567",
  },
  parties: { full_name: "R. Kumar", mobile: "+919812345678", email: null, address: "12 MG Road", city: "Bengaluru", state: "KA", postal_code: "560001" },
  sale_payments: { payment_method: "UPI" },
  organizations: { name: "Salam Motors" },
  app_settings: { whatsapp_business_number: "+919876543210", website_url: "salammotors.example" },
};

/** Records what the code under test did, so the assertions can check the writes. */
interface Recorder {
  uploads: { path: string; bytes: Uint8Array; options: Record<string, unknown> }[];
  inserts: { table: string; values: Record<string, unknown> }[];
  updates: { table: string; values: Record<string, unknown> }[];
}

/**
 * A Supabase client with just enough of the fluent builder to run this module.
 *
 * Typed as the same structural `SupabaseClientLike` the code under test takes, so the stub
 * stays honest about what it is standing in for without importing the real client. Tables
 * absent from ROWS answer with no row, which is the right default for the two lookup
 * probes (a prior signature, an existing document); `present` overrides that per test.
 */
function stubClient(
  recorder: Recorder,
  missing: string[] = [],
  present: Record<string, unknown> = {},
): SupabaseClientLike {
  const result = (table: string) => ({
    data: table in present
      ? present[table]
      : missing.includes(table) ? null : ROWS[table] ?? null,
  });
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "limit"]) {
      chain[method] = () => chain;
    }
    chain.is = () => chain;
    chain.maybeSingle = () => Promise.resolve(result(table));
    chain.single = () => Promise.resolve(result(table));
    chain.insert = (values: Record<string, unknown>) => {
      recorder.inserts.push({ table, values });
      return {
        select: () => ({
          single: () => Promise.resolve({ data: { id: `${table}-row` }, error: null }),
        }),
      };
    };
    chain.update = (values: Record<string, unknown>) => {
      recorder.updates.push({ table, values });
      return {
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: `${table}-row` }, error: null }),
          }),
        }),
      };
    };
    return chain;
  };
  return {
    from: (table: string) => builder(table),
    storage: {
      from: () => ({
        upload: (path: string, bytes: Uint8Array, options: Record<string, unknown>) => {
          recorder.uploads.push({ path, bytes, options });
          return Promise.resolve({ error: null });
        },
      }),
    },
  };
}

function recorder(): Recorder {
  return { uploads: [], inserts: [], updates: [] };
}

Deno.test("the agreement is stored under the org and filed against the vehicle", async () => {
  const record = recorder();
  const client = stubClient(record);
  const result = await prepareSaleAgreement(client, client, {
    orgId: ORG_ID,
    saleId: SALE_ID,
    reference: SALE_ID,
    dealerEmail: "owner@example.com",
  });

  assert(
    result.path === `${ORG_ID}/${VEHICLE_ID}/sale-agreements/${SALE_ID}.pdf`,
    `unexpected storage path: ${result.path}`,
  );
  // The org-id first segment is what the storage RLS policies key on; a path that loses it
  // would be readable by no one.
  assert(record.uploads[0].path.startsWith(`${ORG_ID}/`), "upload path is not org-prefixed");
  assert(record.uploads[0].options.contentType === "application/pdf", "wrong content type");
  assert(record.uploads[0].bytes.length > 0, "an empty file was uploaded");

  const filed = record.inserts.find((item) => item.table === "vehicle_documents");
  assert(filed, "the agreement was not filed as a vehicle document");
  assert(filed.values.document_type === "Sale agreement", "wrong document type");
  assert(filed.values.vehicle_id === VEHICLE_ID, "filed against the wrong vehicle");
  // org_id must be explicit: the service-role client carries no JWT, so the column's
  // current_org_id() default resolves to null and the not-null constraint would reject it.
  assert(filed.values.org_id === ORG_ID, "org_id was not set explicitly");
  assert(
    filed.values.verification_status === "Uploaded",
    "a generated document must not mark itself verified",
  );
});

Deno.test("signers are the buyer then the dealer, and overrides win", async () => {
  const record = recorder();
  const client = stubClient(record);
  const plain = await prepareSaleAgreement(client, client, {
    orgId: ORG_ID,
    saleId: SALE_ID,
    reference: "ref-2",
    dealerEmail: "owner@example.com",
  });
  assert(plain.signers[0].name === "R. Kumar", "the buyer must sign first");
  assert(plain.signers[0].mobile === "+919812345678", "buyer mobile was not carried over");
  assert(plain.signers[1].name === "Salam Motors", "the dealer must sign second");
  assert(plain.signers[1].email === "owner@example.com", "dealer email was not carried over");
  // The buyer party has no email; an absent contact must be omitted rather than sent empty.
  assert(!("email" in plain.signers[0]), "an empty contact field was sent");

  const overridden = await prepareSaleAgreement(client, client, {
    orgId: ORG_ID,
    saleId: SALE_ID,
    reference: "ref-3",
    signerOverrides: [{ mobile: "+919000000000", email: "buyer@example.com" }],
  });
  assert(overridden.signers[0].mobile === "+919000000000", "override did not take effect");
  assert(overridden.signers[0].email === "buyer@example.com", "override did not add an email");
  assert(overridden.signers[0].name === "R. Kumar", "an absent override must not blank the name");
});

Deno.test("the document states the net payable, not the headline price", async () => {
  const record = recorder();
  const client = stubClient(record);
  await prepareSaleAgreement(client, client, {
    orgId: ORG_ID,
    saleId: SALE_ID,
    reference: "ref-4",
  });
  const text = new TextDecoder("latin1").decode(record.uploads[0].bytes);
  // 485000 + 5000 - 10000
  assert(text.includes("Rs. 4,80,000"), "net payable was not computed from the sale row");
});

Deno.test("a sale the caller cannot see is reported as not found", async () => {
  const record = recorder();
  const client = stubClient(record, ["sales"]);
  const error = await prepareSaleAgreement(client, client, {
    orgId: ORG_ID,
    saleId: SALE_ID,
    reference: "ref-5",
  }).catch((thrown) => thrown);

  assert(error instanceof ProteanHttpError, "expected a ProteanHttpError");
  assert(error.status === 404, `expected 404, got ${error.status}`);
  assert(record.uploads.length === 0, "nothing may be written for an unreadable sale");
});

Deno.test("regenerating replaces the agreement instead of filing another one", async () => {
  const record = recorder();
  const client = stubClient(record, [], { vehicle_documents: { id: "existing-doc" } });
  const result = await prepareSaleAgreement(client, client, {
    orgId: ORG_ID,
    saleId: SALE_ID,
    reference: SALE_ID,
  });

  assert(result.path.endsWith(`${SALE_ID}.pdf`), `path is not keyed by the sale: ${result.path}`);
  assert(record.uploads[0].options.upsert === true, "the stored file must be replaced in place");
  assert(
    record.inserts.every((item) => item.table !== "vehicle_documents"),
    "a second document row was filed for the same agreement",
  );
  assert(
    record.updates.some((item) => item.table === "vehicle_documents"),
    "the existing document row was not updated",
  );
});

Deno.test("a signed agreement is never overwritten by a later regeneration", async () => {
  const record = recorder();
  const client = stubClient(record, [], {
    protean_document_requests: { id: "completed-request" },
    vehicle_documents: null,
  });
  const result = await prepareSaleAgreement(client, client, {
    orgId: ORG_ID,
    saleId: SALE_ID,
    reference: SALE_ID,
  });

  assert(
    !result.path.endsWith(`${SALE_ID}.pdf`),
    "the regenerated file took the path of the already-signed one",
  );
  assert(result.path.includes(SALE_ID), "the new file should still be identifiable by sale");
  assert(
    record.inserts.some((item) => item.table === "vehicle_documents"),
    "the regenerated agreement should be filed as its own document",
  );
});
