import {
  buildMasterESignRequest,
  normalizeEmail,
  normalizeMobile,
  sanitizeDocumentName,
  splitName,
} from "./esign-request.ts";
import { ProteanHttpError } from "./http.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const BASE = {
  referenceId: "5a1e0000-0000-4000-8000-000000000001",
  documentName: "Sale agreement — KA01AB1234",
  pdfBase64: "JVBERi0xLjQK",
  organizationRegType: "NonLoan-Individual",
  signers: [
    { name: "R. Kumar", mobile: "+91 98123 45678", email: "Kumar@Example.COM" },
    { name: "Salam Motors", email: "owner@example.com" },
  ],
};

Deno.test("document names are reduced to what Protean accepts", () => {
  // Guide §4.4.1 row 2: alphanumeric with single spaces only. Our label has an em dash.
  assert(
    sanitizeDocumentName("Sale agreement — KA01AB1234") === "Sale agreement KA01AB1234",
    sanitizeDocumentName("Sale agreement — KA01AB1234"),
  );
  assert(sanitizeDocumentName("  a  b  ") === "a b", "spaces were not collapsed");
  assert(sanitizeDocumentName("!!!").length > 0, "an all-punctuation name must not become empty");
  assert(sanitizeDocumentName("x".repeat(200)).length === 100, "name was not clamped to 100");
});

Deno.test("mobile numbers are reduced to a bare ten-digit integer", () => {
  assert(normalizeMobile("+91 98123 45678") === 9812345678, "country code was not stripped");
  assert(normalizeMobile("09812345678") === 9812345678, "leading zero was not stripped");
  assert(normalizeMobile("9812345678") === 9812345678, "a clean number was altered");
  // Must start 6–9 and be exactly ten digits.
  assert(normalizeMobile("5812345678") === null, "an invalid prefix was accepted");
  assert(normalizeMobile("98123") === null, "a short number was accepted");
  assert(normalizeMobile(null) === null, "null was not handled");
});

Deno.test("emails are lowercased and obviously invalid ones rejected", () => {
  assert(normalizeEmail("Kumar@Example.COM") === "kumar@example.com", "not lowercased");
  assert(normalizeEmail("not-an-email") === null, "an invalid address was accepted");
  assert(normalizeEmail("  ") === null, "blank was not handled");
});

Deno.test("names are split and clamped to the guide's limits", () => {
  assert(splitName("R. Kumar").firstName === "R.", "first name wrong");
  assert(splitName("R. Kumar").lastName === "Kumar", "last name wrong");
  assert(splitName("Kumar").lastName === undefined, "a single-word name must not invent a surname");

  // Both caps bind at once: 50 per part, 90 across all three. A 50-character first name
  // leaves only 40 for the surname, not another 50.
  const long = splitName(`${"a".repeat(60)} ${"b".repeat(60)} ${"c".repeat(60)}`);
  assert(long.firstName.length === 50, "first name was not clamped to 50");
  assert((long.lastName ?? "").length <= 50, "last name exceeds the per-part cap");
  assert((long.lastName ?? "").length > 0, "the surname should survive, shortened");
  const total = long.firstName.length + (long.middleName ?? "").length + (long.lastName ?? "").length;
  assert(total <= 90, `combined name length ${total} exceeds 90`);
});

Deno.test("a plain agreement builds a sequential, unstamped request", () => {
  const request = buildMasterESignRequest(BASE);

  assert(request.documentType === "Purchase Agreement", "wrong document type");
  assert(request.pdfFiles[0].startsWith("data:application/pdf;base64,"), "missing data URI prefix");
  assert(request.isSequentialSign === true, "should be sequential");
  assert(request.isStampDutyRequired === undefined, "no stamp was asked for");
  assert(request.recipientData[0].signOrder === 1, "buyer should sign first");
  assert(request.recipientData[1].signOrder === 2, "dealer should sign second");
  assert(request.recipientData[0].mobileNumber === 9812345678, "mobile not normalized");
  assert(request.recipientData[0].emailId === "kumar@example.com", "email not normalized");
  assert(request.recipientData[0].selectedSignType === "Aadhaar", "wrong sign type");
});

Deno.test("a signer with no usable contact is rejected before the call is made", () => {
  const error = ((): unknown => {
    try {
      buildMasterESignRequest({
        ...BASE,
        signers: [{ name: "R. Kumar", mobile: "12345", email: "nope" }],
      });
      return null;
    } catch (thrown) {
      return thrown;
    }
  })();

  assert(error instanceof ProteanHttpError, "expected a ProteanHttpError");
  assert(error.status === 400, `expected 400, got ${error.status}`);
  assert(error.message.includes("signing link"), "the message should explain why it matters");
});

Deno.test("an eStamp adds stampData and demands the extra signer fields", () => {
  const stamp = {
    stateId: 29,
    articleCode: "5 - General Agreement (1003)",
    stampAmount: 500,
    considerationPrice: 480000,
    paidBy: "firstParty" as const,
    firstPartyName: "Salam Motors",
    secondPartyName: "R. Kumar",
  };

  // Without the per-signer eStamp fields, the request must fail here rather than at Protean.
  const rejected = ((): unknown => {
    try {
      buildMasterESignRequest({ ...BASE, stamp });
      return null;
    } catch (thrown) {
      return thrown;
    }
  })();
  assert(rejected instanceof ProteanHttpError, "expected a ProteanHttpError");
  assert(rejected.message.includes("date of birth"), rejected.message);

  const request = buildMasterESignRequest({
    ...BASE,
    stamp,
    signers: BASE.signers.map((signer) => ({
      ...signer,
      dob: "1990-05-02",
      pan: "abcpk1234c",
    })),
  });

  assert(request.isStampDutyRequired === true, "stamp flag not set");
  assert(request.stampData?.stampType === "e-Stamp", "wrong stamp type");
  assert(request.stampData?.considerationPrice === 480000, "consideration price wrong");
  assert(request.stampData?.organizationRegType === "NonLoan-Individual", "reg type wrong");
  assert(request.stampData?.stamps[0].stampAmount === 500, "stamp amount wrong");
  assert(
    request.stampData?.estampdtls.secondPartyName === "R Kumar",
    request.stampData?.estampdtls.secondPartyName ?? "missing",
  );
  assert(request.recipientData[0].recipientPan === "ABCPK1234C", "PAN not upper-cased");
  assert(request.recipientData[0].recipientDob === "1990-05-02", "dob not carried");
  // PAN and OVD are mutually exclusive (guide §4.4.1.3 row 33).
  assert(request.recipientData[0].recipientOvdNumber === undefined, "sent both PAN and OVD");
});

Deno.test("an OVD signer sends OVD fields and no PAN", () => {
  const request = buildMasterESignRequest({
    ...BASE,
    stamp: {
      stateId: 29,
      articleCode: "5 - General Agreement (1003)",
      stampAmount: 500,
      considerationPrice: 100,
      paidBy: "secondParty",
      firstPartyName: "Salam Motors",
      secondPartyName: "R Kumar",
    },
    signers: [{
      ...BASE.signers[0],
      dob: "1990-05-02",
      ovdType: "Voter ID",
      ovdNumber: "AAA1234567",
    }],
  });

  const recipient = request.recipientData[0];
  assert(recipient.recipientPan === undefined, "PAN must be absent when an OVD is used");
  assert(recipient.recipientOvdType === "Voter ID", "OVD type wrong");
  assert(recipient.recipientOvdNumber === "AAA1234567", "OVD number wrong");
  assert(recipient.recipientCustomOvdType === undefined, "custom type only applies to Others");
  assert(request.stampData?.stampdutyPaidby === "secondParty", "payer not carried");
});
