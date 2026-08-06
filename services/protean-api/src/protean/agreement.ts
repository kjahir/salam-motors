// The sale agreement that gets signed.
//
// eSign signs a document, and until now nothing in this app produced one — the
// protean-esign function sent Protean a label and a list of signers with no file
// attached. This module builds the file: a one- or two-page sale agreement laid out
// from the sale record, rendered to a PDF with no third-party dependency.
//
// Why hand-rolled rather than pdf-lib: the rest of this repo's Deno code is tested
// offline with `deno test`, and a remote esm.sh import would make this module's tests
// need the network to run. A fixed-layout text document is a small enough slice of PDF
// (one content stream of positioned text, the two standard Helvetica faces, no images,
// no embedded fonts) that writing it directly costs less than the dependency does.
//
// ============================================================================
// LIMITATION — Latin script only
// ============================================================================
// The standard PDF fonts used here are WinAnsi-encoded, so they can render Latin-1
// and nothing else. A buyer whose name is stored in Tamil or Devanagari script comes
// out as "?" characters (see `winAnsi`). Rendering Indic scripts means embedding a
// Unicode font and subsetting it, which is a different and much larger job. The rupee
// sign has the same problem, so amounts are written "Rs." rather than "₹".
// ============================================================================

export interface SaleAgreementParty {
  name: string;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface SaleAgreementInput {
  /** Shown on the document so a signed copy can be traced back to its request row. */
  reference: string;
  generatedAt: string;
  dealer: SaleAgreementParty;
  buyer: SaleAgreementParty;
  vehicle: {
    description: string;
    registrationNumber?: string | null;
    stockNumber?: string | null;
    chassisNumber?: string | null;
    engineNumber?: string | null;
    odometer?: number | null;
    manufactureYear?: number | null;
  };
  sale: {
    saleDate: string;
    salePrice: number;
    discount: number;
    buyerCharges: number;
    netPayable: number;
    paymentMethod?: string | null;
    paymentStatus?: string | null;
    deliveryStatus?: string | null;
    deliveryLocation?: string | null;
    notes?: string | null;
  };
}

type Style = "title" | "heading" | "body" | "strong" | "spacer" | "rule" | "signature";

interface Block {
  style: Style;
  text?: string;
  /** Two-column rows render as "Label            Value". */
  label?: string;
  value?: string;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const VALUE_COLUMN = 200;
/** How far below its baseline the signature block reaches: two rules plus two label rows. */
const SIGNATURE_BLOCK_DEPTH = 56;

/**
 * Indian digit grouping: 4,85,000 rather than 485,000.
 *
 * Written out here rather than reached for from Intl because the value has to match what
 * the app shows the dealer elsewhere (`formatINR`), and a document that disagrees with the
 * screen about the sale price is worse than one that is merely plain.
 */
export function formatRupees(amount: number): string {
  const negative = amount < 0;
  const whole = Math.round(Math.abs(amount)).toString();
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3);
  const grouped = rest
    ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`
    : last3;
  return `${negative ? "-" : ""}Rs. ${grouped}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

function contactLine(party: SaleAgreementParty): string | null {
  const parts = [party.mobile, party.email].filter((item): item is string =>
    typeof item === "string" && item.trim() !== ""
  );
  return parts.length > 0 ? parts.join("  ·  ") : null;
}

/**
 * The agreement's content, as ordered blocks.
 *
 * Split from rendering so the wording can be asserted in tests without going through the
 * PDF byte layer, and so a future HTML preview can reuse it.
 */
export function saleAgreementBlocks(input: SaleAgreementInput): Block[] {
  const { dealer, buyer, vehicle, sale } = input;
  const blocks: Block[] = [
    { style: "title", text: "SALE AGREEMENT" },
    {
      style: "body",
      text:
        `Reference ${input.reference}  ·  Generated ${formatDate(input.generatedAt)}`,
    },
    { style: "rule" },
    { style: "heading", text: "Parties" },
    { style: "strong", text: `Seller: ${dealer.name}` },
  ];

  const dealerContact = contactLine(dealer);
  if (dealerContact) blocks.push({ style: "body", text: dealerContact });
  if (dealer.address) blocks.push({ style: "body", text: dealer.address });

  blocks.push({ style: "spacer" });
  blocks.push({ style: "strong", text: `Buyer: ${buyer.name}` });
  const buyerContact = contactLine(buyer);
  if (buyerContact) blocks.push({ style: "body", text: buyerContact });
  if (buyer.address) blocks.push({ style: "body", text: buyer.address });

  blocks.push({ style: "spacer" });
  blocks.push({ style: "heading", text: "Vehicle" });
  blocks.push({ style: "strong", text: vehicle.description });
  const vehicleRows: [string, string | null | undefined][] = [
    ["Registration number", vehicle.registrationNumber],
    ["Stock number", vehicle.stockNumber],
    ["Chassis number", vehicle.chassisNumber],
    ["Engine number", vehicle.engineNumber],
    ["Year of manufacture", vehicle.manufactureYear ? String(vehicle.manufactureYear) : null],
    [
      "Odometer",
      typeof vehicle.odometer === "number" ? `${vehicle.odometer.toLocaleString("en-IN")} km` : null,
    ],
  ];
  for (const [label, value] of vehicleRows) {
    if (value) blocks.push({ style: "body", label, value });
  }

  blocks.push({ style: "spacer" });
  blocks.push({ style: "heading", text: "Consideration" });
  blocks.push({ style: "body", label: "Sale price", value: formatRupees(sale.salePrice) });
  if (sale.discount > 0) {
    blocks.push({ style: "body", label: "Discount", value: `- ${formatRupees(sale.discount)}` });
  }
  if (sale.buyerCharges > 0) {
    blocks.push({ style: "body", label: "Buyer charges", value: formatRupees(sale.buyerCharges) });
  }
  blocks.push({ style: "strong", label: "Net payable", value: formatRupees(sale.netPayable) });
  blocks.push({ style: "spacer" });
  blocks.push({ style: "body", label: "Sale date", value: formatDate(sale.saleDate) });
  if (sale.paymentMethod) {
    blocks.push({ style: "body", label: "Payment method", value: sale.paymentMethod });
  }
  if (sale.paymentStatus) {
    blocks.push({ style: "body", label: "Payment status", value: sale.paymentStatus });
  }
  if (sale.deliveryStatus) {
    blocks.push({ style: "body", label: "Delivery", value: sale.deliveryStatus });
  }
  if (sale.deliveryLocation) {
    blocks.push({ style: "body", label: "Delivery location", value: sale.deliveryLocation });
  }
  if (sale.notes) {
    blocks.push({ style: "spacer" });
    blocks.push({ style: "heading", text: "Notes" });
    blocks.push({ style: "body", text: sale.notes });
  }

  blocks.push({ style: "spacer" });
  blocks.push({ style: "heading", text: "Declarations" });
  for (const clause of DECLARATIONS) blocks.push({ style: "body", text: clause });

  blocks.push({ style: "spacer" });
  blocks.push({ style: "signature", label: dealer.name, value: buyer.name });
  return blocks;
}

/**
 * Fixed clauses.
 *
 * Deliberately minimal and factual — this states what the two parties are agreeing to in
 * the transaction the app already recorded. It is not drafted legal advice, and a dealer
 * whose state or business needs different terms should have them reviewed; that is called
 * out in the app copy next to the button that generates this.
 */
const DECLARATIONS = [
  "1. The Seller confirms that the vehicle described above is sold on an as-is basis, and that the Seller has the right to sell it.",
  "2. The Buyer confirms having inspected the vehicle and having accepted its present condition.",
  "3. Ownership passes to the Buyer on receipt of the net payable amount in full.",
  "4. The Buyer is responsible for transfer of registration and for all liabilities arising after the date of delivery.",
  "5. Both parties confirm that the details recorded above are correct.",
];

// ---------------------------------------------------------------------------
// PDF rendering
// ---------------------------------------------------------------------------

interface Line {
  text?: string;
  label?: string;
  value?: string;
  bold: boolean;
  size: number;
  gapBefore: number;
  rule?: boolean;
  signature?: boolean;
}

const STYLE_METRICS: Record<Style, { size: number; bold: boolean; gapBefore: number }> = {
  title: { size: 18, bold: true, gapBefore: 0 },
  heading: { size: 12, bold: true, gapBefore: 10 },
  strong: { size: 10, bold: true, gapBefore: 1 },
  body: { size: 10, bold: false, gapBefore: 1 },
  spacer: { size: 10, bold: false, gapBefore: 6 },
  rule: { size: 10, bold: false, gapBefore: 6 },
  signature: { size: 10, bold: false, gapBefore: 26 },
};

/**
 * Approximate text width.
 *
 * Helvetica's real per-glyph widths live in an AFM table that would have to be embedded to
 * measure exactly. Wrapping is the only thing that needs a width here, so a slightly
 * generous average is enough: erring wide wraps a line early, which looks fine, whereas
 * erring narrow would run text past the margin.
 */
function estimateWidth(text: string, size: number): number {
  return text.length * size * 0.52;
}

function wrap(text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateWidth(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function blocksToLines(blocks: Block[]): Line[] {
  const lines: Line[] = [];
  for (const block of blocks) {
    const metrics = STYLE_METRICS[block.style];
    if (block.style === "spacer") {
      lines.push({ bold: false, size: metrics.size, gapBefore: metrics.gapBefore });
      continue;
    }
    if (block.style === "rule") {
      lines.push({ bold: false, size: metrics.size, gapBefore: metrics.gapBefore, rule: true });
      continue;
    }
    if (block.style === "signature") {
      lines.push({
        label: block.label,
        value: block.value,
        bold: false,
        size: metrics.size,
        gapBefore: metrics.gapBefore,
        signature: true,
      });
      continue;
    }
    if (block.label !== undefined) {
      lines.push({
        label: block.label,
        value: block.value,
        bold: metrics.bold,
        size: metrics.size,
        gapBefore: metrics.gapBefore,
      });
      continue;
    }
    const wrapped = wrap(block.text ?? "", metrics.size, CONTENT_WIDTH);
    wrapped.forEach((text, index) => {
      lines.push({
        text,
        bold: metrics.bold,
        size: metrics.size,
        gapBefore: index === 0 ? metrics.gapBefore : 0,
      });
    });
  }
  return lines;
}

/** PDF string literals escape these three; everything else goes through as bytes. */
function pdfEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Drops what the standard fonts cannot draw.
 *
 * Typographic punctuation the app's copy uses freely (curly quotes, en/em dashes, the
 * middle dot) has a plain Latin-1 equivalent and is mapped to it. Anything else outside
 * Latin-1 — any Indic script — becomes "?", because the alternative is a PDF that renders
 * as blank space with no indication that something was lost.
 */
function winAnsi(text: string): string {
  const mapped = text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/·/g, "-")
    .replace(/₹/g, "Rs.");
  let out = "";
  for (const char of mapped) {
    const code = char.codePointAt(0) ?? 63;
    out += code <= 0xff ? char : "?";
  }
  return out;
}

function textOperator(text: string, x: number, y: number, bold: boolean, size: number): string {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(winAnsi(text))}) Tj ET\n`;
}

function pageStreams(lines: Line[]): string[] {
  const streams: string[] = [];
  let stream = "";
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    streams.push(stream);
    stream = "";
    y = PAGE_HEIGHT - MARGIN;
  };

  for (const line of lines) {
    const advance = line.gapBefore + line.size * 1.22;
    // The signature block draws well below its own baseline (two rules, then two labelled
    // names under them), so the break test has to reserve that whole depth. Testing only
    // the baseline would let it start near the foot of a page and draw off it.
    const needed = advance + (line.signature ? SIGNATURE_BLOCK_DEPTH : 0);
    if (y - needed < MARGIN) newPage();
    y -= advance;

    if (line.rule) {
      stream += `0.8 w 0.75 G ${MARGIN} ${y + line.size * 0.4} m ${PAGE_WIDTH - MARGIN} ${y + line.size * 0.4} l S 0 G\n`;
      continue;
    }
    if (line.signature) {
      const lineY = y - 24;
      const rightX = MARGIN + CONTENT_WIDTH / 2 + 20;
      const width = CONTENT_WIDTH / 2 - 40;
      stream += `0.8 w 0.4 G ${MARGIN} ${lineY} m ${MARGIN + width} ${lineY} l S\n`;
      stream += `${rightX} ${lineY} m ${rightX + width} ${lineY} l S 0 G\n`;
      stream += textOperator("Seller", MARGIN, lineY - 14, true, 9);
      stream += textOperator("Buyer", rightX, lineY - 14, true, 9);
      stream += textOperator(line.label ?? "", MARGIN, lineY - 26, false, 9);
      stream += textOperator(line.value ?? "", rightX, lineY - 26, false, 9);
      y = lineY - 26;
      continue;
    }
    if (line.label !== undefined) {
      stream += textOperator(line.label, MARGIN, y, false, line.size);
      stream += textOperator(line.value ?? "", MARGIN + VALUE_COLUMN, y, line.bold, line.size);
      continue;
    }
    if (line.text) stream += textOperator(line.text, MARGIN, y, line.bold, line.size);
  }
  streams.push(stream);
  return streams;
}

/**
 * Assembles the PDF file.
 *
 * Object layout is fixed: catalog, page tree, the two fonts, then a (page, content) pair
 * per page. The xref table needs each object's byte offset, so the body is built as an
 * array of strings and offsets are accumulated as they are appended.
 */
export function renderAgreementPdf(input: SaleAgreementInput): Uint8Array {
  const streams = pageStreams(blocksToLines(saleAgreementBlocks(input)));
  const pageCount = streams.length;
  const firstPageObject = 5;
  const pageIds = streams.map((_, index) => firstPageObject + index * 2);

  const objects: string[] = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
  ];
  streams.forEach((stream, index) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  });

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  // Latin-1 rather than UTF-8: `winAnsi` has already reduced every string to code points
  // that fit in a byte, and the /Length counts above are byte counts, so a multi-byte
  // encoding here would desync the stream lengths and produce a corrupt file.
  const full = body + xref + trailer;
  const bytes = new Uint8Array(full.length);
  for (let index = 0; index < full.length; index += 1) {
    bytes[index] = full.charCodeAt(index) & 0xff;
  }
  return bytes;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
