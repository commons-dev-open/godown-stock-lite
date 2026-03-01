import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDecimal } from "../../shared/numbers";
import {
  downloadPdf,
  formatBillDateTime,
  formatDateForFile,
  sanitizeForFilename,
} from "./exportUtils";
import type { Invoice, InvoiceLine, InvoiceUnit } from "../../shared/types";

export type CompanySettings = Record<string, string>;

const PDF_RUPEE = "Rs. ";

/** A4 portrait for clean print-style invoice */
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
/** Compact margins to avoid excessive white space */
const MARGIN_MM = 8;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - 2 * MARGIN_MM;

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
    format: [PAGE_WIDTH_MM, PAGE_HEIGHT_MM],
  });
  let y = MARGIN_MM;

  const companyName = companySettings?.company_name?.trim();
  const companyAddress = companySettings?.company_address?.trim();
  const gstin = companySettings?.gstin?.trim();
  const ownerPhone = companySettings?.owner_phone?.trim();

  const lineHeight = (fontSize: number, compact = false) =>
    fontSize * (compact ? 1.05 : 1.25);

  // Company name at top (large, bold – like print header)
  if (companyName) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const nameLines = doc.splitTextToSize(companyName, CONTENT_WIDTH_MM);
    doc.text(nameLines, MARGIN_MM, y);
    y += 5;
    doc.setFont("helvetica", "normal");
  }
  y += 2;
  doc.setFontSize(9);
  if (companyAddress) {
    doc.text(companyAddress, MARGIN_MM, y);
    y += 5;
  }
  if (ownerPhone) {
    doc.text(`Phone: ${ownerPhone}`, MARGIN_MM, y);
    y += 5;
  }
  if (gstin) {
    doc.text(`GST No.: ${gstin}`, MARGIN_MM, y);
    y += 5;
  }

  //Add a horizontal line below the heading
  doc.line(MARGIN_MM, y + 1, CONTENT_WIDTH_MM + MARGIN_MM, y + 1);
  y += 8;
  doc.setFont("helvetica", "normal");

  // Invoice details
  doc.setFontSize(9);
  if (invoice.invoice_number) {
    doc.text(`# ${invoice.invoice_number}`, MARGIN_MM, y);
    y += 5;
  }
  const billDateTime = formatBillDateTime(new Date());
  doc.text(`Date: ${billDateTime}`, MARGIN_MM, y);
  y += 5;
  if (invoice.customer_name) {
    doc.text(`Customer: ${invoice.customer_name}`, MARGIN_MM, y);
    y += 5;
  }
  if (invoice.customer_address) {
    doc.text(`Address: ${invoice.customer_address}`, MARGIN_MM, y);
    y += 5;
  }

  // Table: dark gray header with white text, clean body (minimal/no grid)
  const columns = ["Product", "Qty", "Unit", "Price/unit", "Amt"];
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
      0: { cellWidth: 78, fontSize: 9, overflow: "linebreak" },
      1: { cellWidth: 22, fontSize: 9, halign: "right" },
      2: { cellWidth: 18, fontSize: 9 },
      3: { cellWidth: 28, fontSize: 9, halign: "right" },
      4: { cellWidth: 28, fontSize: 9, halign: "right" },
    },
    headStyles: {
      fontSize: 9,
      halign: "left",
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 9, textColor: [0, 0, 0] },
    theme: "plain",
    tableLineColor: [220, 220, 220],
    tableLineWidth: 0.1,
  });

  const finalY =
    (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
      ?.finalY ?? y + 15;
  const total = lines.reduce(
    (sum, line) => sum + (line.amount ?? line.quantity * line.price),
    0
  );

  if (finalY + 12 > PAGE_HEIGHT_MM - MARGIN_MM) {
    doc.addPage([PAGE_WIDTH_MM, PAGE_HEIGHT_MM], "portrait");
    y = MARGIN_MM;
  } else {
    y = finalY + 3;
  }
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  y += 3;
  doc.text(`Total: ${PDF_RUPEE}${formatDecimal(total)}`, MARGIN_MM, y);

  const safeNum = invoice.invoice_number
    ? sanitizeForFilename(invoice.invoice_number)
    : `invoice-${invoice.id}`;
  downloadPdf(doc, `invoice-${safeNum}-${formatDateForFile(new Date())}.pdf`);
}
