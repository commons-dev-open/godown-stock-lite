import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDecimal } from "../../shared/numbers";
import {
  formatBillDateTime,
  formatDateForFile,
  sanitizeForFilename,
} from "./exportUtils";
import type { Invoice, InvoiceLine, InvoiceUnit } from "../../shared/types";

export type CompanySettings = Record<string, string>;

const PDF_RUPEE = "Rs. ";

/** 80mm width = standard thermal/billing receipt printer paper (3⅛") */
const BILLING_PAPER_WIDTH_MM = 80;
/** Single strip height; thermal rolls are continuous, this is one "page" */
const BILLING_PAPER_HEIGHT_MM = 297;
const MARGIN_MM = 4;
const CONTENT_WIDTH_MM = BILLING_PAPER_WIDTH_MM - 2 * MARGIN_MM;

/** Resolve unit name to short display (symbol) for invoice. */
function unitToShort(unitName: string, units: InvoiceUnit[]): string {
  if (!unitName) return unitName;
  const u = units.find((x) => x.name === unitName);
  const short = u?.symbol?.trim();
  return short ?? unitName;
}

export function exportInvoiceToPdf(
  invoice: Invoice,
  lines: InvoiceLine[],
  companySettings?: CompanySettings | null,
  invoiceUnits: InvoiceUnit[] = []
): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [BILLING_PAPER_WIDTH_MM, BILLING_PAPER_HEIGHT_MM],
  });
  doc.setMargins(MARGIN_MM, MARGIN_MM, MARGIN_MM);
  let y = MARGIN_MM;

  const companyName = companySettings?.company_name?.trim();
  const companyAddress = companySettings?.company_address?.trim();
  const gstin = companySettings?.gstin?.trim();
  const ownerName = companySettings?.owner_name?.trim();

  const pushText = (text: string, fontSize: number, lineHeight = 3): number => {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, CONTENT_WIDTH_MM);
    doc.text(lines, MARGIN_MM, y);
    y += lines.length * lineHeight;
    return y;
  };

  // Company name at top (from settings)
  if (companyName) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    const nameLines = doc.splitTextToSize(companyName, CONTENT_WIDTH_MM);
    doc.text(nameLines, MARGIN_MM, y);
    y += nameLines.length * 4;
    doc.setFont("helvetica", "normal");
  }
  if (companyAddress) {
    pushText(companyAddress, 8, 3);
  }
  if (gstin) {
    pushText(`GST No.: ${gstin}`, 7, 2.5);
  }
  if (ownerName) {
    pushText(`Owner: ${ownerName}`, 7, 2.5);
  }
  y += 2;

  doc.setFontSize(9);
  doc.text("INVOICE", MARGIN_MM, y);
  y += 4;

  doc.setFontSize(7);
  if (invoice.invoice_number) {
    doc.text(`# ${invoice.invoice_number}`, MARGIN_MM, y);
    y += 3;
  }
  const billDateTime = formatBillDateTime(new Date());
  doc.text(`Date: ${billDateTime}`, MARGIN_MM, y);
  y += 3;
  if (invoice.customer_name) {
    const customerLines = doc.splitTextToSize(
      invoice.customer_name,
      CONTENT_WIDTH_MM
    );
    doc.text(customerLines, MARGIN_MM, y);
    y += customerLines.length * 3;
  }
  if (invoice.customer_address) {
    const addrLines = doc.splitTextToSize(
      invoice.customer_address,
      CONTENT_WIDTH_MM
    );
    doc.text(addrLines, MARGIN_MM, y);
    y += addrLines.length * 3;
  }
  y += 5;

  const columns = ["Product", "Qty", "Unit", "Price", "Amt"];
  const body = lines.map((line) => {
    const amount = line.amount ?? line.quantity * line.price;
    return [
      line.product_name ?? "",
      formatDecimal(line.quantity),
      unitToShort(line.unit, invoiceUnits),
      PDF_RUPEE + formatDecimal(line.price),
      PDF_RUPEE + formatDecimal(amount),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [columns],
    body,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: CONTENT_WIDTH_MM,
    columnStyles: {
      0: { cellWidth: 28, fontSize: 6, overflow: "linebreak" },
      1: { cellWidth: 10, fontSize: 6 },
      2: { cellWidth: 8, fontSize: 6 },
      3: { cellWidth: 12, fontSize: 6 },
      4: { cellWidth: 14, fontSize: 6 },
    },
    headStyles: { fontSize: 6, fillColor: [80, 80, 80] },
    styles: { fontSize: 6 },
  });

  const finalY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 15;
  const total = lines.reduce(
    (sum, line) => sum + (line.amount ?? line.quantity * line.price),
    0
  );

  if (finalY + 12 > BILLING_PAPER_HEIGHT_MM - MARGIN_MM) {
    doc.addPage([BILLING_PAPER_WIDTH_MM, BILLING_PAPER_HEIGHT_MM], "portrait");
    y = MARGIN_MM;
  } else {
    y = finalY + 4;
  }
  doc.setFontSize(8);
  doc.text(`Total: ${PDF_RUPEE}${formatDecimal(total)}`, MARGIN_MM, y);

  const safeNum = invoice.invoice_number
    ? sanitizeForFilename(invoice.invoice_number)
    : `invoice-${invoice.id}`;
  doc.save(`invoice-${safeNum}-${formatDateForFile(new Date())}.pdf`);
}
