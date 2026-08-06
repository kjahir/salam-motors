import {
  formatRupees,
  renderAgreementPdf,
  saleAgreementBlocks,
  toBase64,
  type SaleAgreementInput,
} from "./agreement.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function input(overrides: Partial<SaleAgreementInput> = {}): SaleAgreementInput {
  return {
    reference: "11111111-1111-4111-8111-111111111111",
    generatedAt: "2026-08-04T09:30:00.000Z",
    dealer: { name: "Salam Motors", mobile: "+919876543210" },
    buyer: { name: "R. Kumar", mobile: "+919812345678", email: "kumar@example.com" },
    vehicle: {
      description: "2019 Maruti Suzuki Swift VXI",
      registrationNumber: "KA01AB1234",
      stockNumber: "SM-0042",
      chassisNumber: "MA3EWDE1S00123456",
      engineNumber: "K12MN1234567",
      odometer: 42180,
      manufactureYear: 2019,
    },
    sale: {
      saleDate: "2026-08-01T00:00:00.000Z",
      salePrice: 485000,
      discount: 10000,
      buyerCharges: 5000,
      netPayable: 480000,
      paymentMethod: "UPI",
      paymentStatus: "Paid",
      deliveryStatus: "Pending",
    },
    ...overrides,
  };
}

Deno.test("rupee amounts use Indian digit grouping", () => {
  assert(formatRupees(485000) === "Rs. 4,85,000", formatRupees(485000));
  assert(formatRupees(1250) === "Rs. 1,250", formatRupees(1250));
  assert(formatRupees(10000000) === "Rs. 1,00,00,000", formatRupees(10000000));
  assert(formatRupees(0) === "Rs. 0", formatRupees(0));
  assert(formatRupees(-5000) === "-Rs. 5,000", formatRupees(-5000));
});

Deno.test("the agreement states both parties, the vehicle, and the money", () => {
  const text = saleAgreementBlocks(input())
    .map((block) => [block.text, block.label, block.value].filter(Boolean).join(" "))
    .join("\n");
  for (const expected of [
    "Salam Motors",
    "R. Kumar",
    "KA01AB1234",
    "MA3EWDE1S00123456",
    "Rs. 4,85,000",
    "Rs. 4,80,000",
    "Ownership passes to the Buyer",
  ]) {
    assert(text.includes(expected), `agreement omitted ${expected}`);
  }
});

Deno.test("zero-value lines are left out rather than printed as zero", () => {
  const blocks = saleAgreementBlocks(
    input({
      sale: { ...input().sale, discount: 0, buyerCharges: 0, netPayable: 485000 },
    }),
  );
  const labels = blocks.map((block) => block.label);
  assert(!labels.includes("Discount"), "a zero discount should not be printed");
  assert(!labels.includes("Buyer charges"), "zero buyer charges should not be printed");
  assert(labels.includes("Net payable"), "the net payable must always be printed");
});

Deno.test("renders a structurally valid single-page PDF", () => {
  const bytes = renderAgreementPdf(input());
  const text = new TextDecoder("latin1").decode(bytes);

  assert(text.startsWith("%PDF-1.4"), "missing PDF header");
  assert(text.trimEnd().endsWith("%%EOF"), "missing EOF marker");
  assert(text.includes("/Type /Catalog"), "missing catalog");
  assert(text.includes("/Type /Page "), "missing page object");
  assert(text.includes("(SALE AGREEMENT)"), "title was not drawn");

  // The xref offsets have to land exactly on their object headers, or a reader rejects
  // the file — this is the part a hand-rolled writer gets wrong.
  const xrefStart = Number(text.slice(text.lastIndexOf("startxref") + 9).trim().split("\n")[0]);
  assert(text.slice(xrefStart, xrefStart + 4) === "xref", "startxref does not point at the table");
  // Skip "xref", the "0 N" subsection header, and the free-object entry.
  const rows = text.slice(xrefStart).split("\n").slice(3);
  const objectCount = Number(text.slice(xrefStart).split("\n")[1].split(" ")[1]) - 1;
  for (let index = 0; index < objectCount; index += 1) {
    const offset = Number(rows[index].slice(0, 10));
    const header = text.slice(offset, offset + 12);
    assert(
      header.startsWith(`${index + 1} 0 obj`),
      `xref entry ${index + 1} points at "${header}"`,
    );
  }
});

Deno.test("stream lengths are byte-accurate for non-ASCII content", () => {
  // A name with an accented character is one byte in Latin-1 and two in UTF-8; if the
  // writer disagrees with itself about which, /Length stops matching the stream.
  const bytes = renderAgreementPdf(input({
    dealer: { name: "Café Motors" },
  }));
  const text = new TextDecoder("latin1").decode(bytes);
  const match = text.match(/<< \/Length (\d+) >>\nstream\n/);
  assert(match, "no content stream found");
  const declared = Number(match[1]);
  const start = (match.index ?? 0) + match[0].length;
  const actual = text.slice(start, start + declared);
  assert(
    text.slice(start + declared, start + declared + 9) === "endstream",
    "declared /Length does not reach exactly to endstream",
  );
  assert(actual.includes("Caf"), "dealer name was not drawn");
  assert(bytes.length === text.length, "byte length must equal Latin-1 character length");
});

Deno.test("scripts the standard fonts cannot draw degrade visibly, not silently", () => {
  const bytes = renderAgreementPdf(input({
    buyer: { name: "இரா. குமார்" },
  }));
  const text = new TextDecoder("latin1").decode(bytes);
  assert(text.includes("Buyer: ?"), "unrenderable script should become visible '?' marks");
});

Deno.test("long notes flow onto following lines instead of past the margin", () => {
  const notes = "This vehicle was sold below the recorded cost. ".repeat(12);
  const bytes = renderAgreementPdf(input({ sale: { ...input().sale, notes } }));
  const text = new TextDecoder("latin1").decode(bytes);
  const drawn = Array.from(text.matchAll(/\(([^)]*)\) Tj/g), (match) => match[1]);
  const noteLines = drawn.filter((line) => line.includes("sold below the recorded cost"));
  assert(noteLines.length > 1, "long notes were not wrapped");
  for (const line of noteLines) {
    assert(line.length < 110, `wrapped line is too long: ${line.length}`);
  }
});

Deno.test("base64 encoding round-trips the exact bytes", () => {
  const bytes = renderAgreementPdf(input());
  const decoded = atob(toBase64(bytes));
  assert(decoded.length === bytes.length, "length changed through base64");
  assert(decoded.charCodeAt(0) === bytes[0], "first byte changed through base64");
});

Deno.test("nothing is drawn below the bottom margin, at any content length", () => {
  // The signature block reaches ~56pt below its own baseline, so a naive break test lets
  // it start low on a page and draw off the bottom. Growing the notes walks the block
  // through every position on the page and asserts it never does.
  for (let repeats = 0; repeats <= 30; repeats += 1) {
    const bytes = renderAgreementPdf(input({
      sale: { ...input().sale, notes: "Delivery deferred by the buyer. ".repeat(repeats) },
    }));
    const text = new TextDecoder("latin1").decode(bytes);
    const baselines = Array.from(
      text.matchAll(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/g),
      (match) => Number(match[2]),
    );
    const lowest = Math.min(...baselines);
    assert(
      lowest >= 40,
      `text drawn at y=${lowest} with ${repeats} repeats — below the printable area`,
    );
  }
});
