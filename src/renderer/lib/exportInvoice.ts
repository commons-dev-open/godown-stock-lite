import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDecimal } from "../../shared/numbers";
import { amountInWords } from "../../shared/gst";
import {
  downloadPdf,
  formatBillDateTime,
  formatDateForFile,
  sanitizeForFilename,
} from "./exportUtils";
import type { Invoice, InvoiceLine, Unit } from "../../shared/types";

export type CompanySettings = Record<string, string>;

const PDF_RUPEE = "Rs. ";

/** A4 portrait for clean print-style invoice */
const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
/** Compact margins to avoid excessive white space */
const MARGIN_MM = 8;
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - 2 * MARGIN_MM;

/** Resolve unit name to short display (symbol) for invoice. */
function unitToShort(unitName: string, units: Unit[]): string {
  if (!unitName) return unitName;
  const u = units.find((x) => x.name === unitName);
  const short = u?.symbol?.trim();
  return short ?? unitName;
}

export function exportInvoiceToPdf(
  invoice: Invoice,
  lines: InvoiceLine[],
  companySettings?: CompanySettings | null,
  invoiceUnits: Unit[] = []
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

  // Company name at top (large, bold - like print header)
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

  const gstEnabled = companySettings?.gst_enabled === "true";
  const anyLineHasGst = lines.some(
    (l) => ((l as { gst_rate?: number }).gst_rate ?? 0) > 0
  );
  const hsnEnabled = companySettings?.hsn_enabled !== "false";
  const hasHsn =
    hsnEnabled &&
    lines.some((l) => (l as { hsn_code?: string | null }).hsn_code);

  let invoiceLabel = "INVOICE";
  if (gstEnabled) {
    invoiceLabel = anyLineHasGst ? "TAX INVOICE" : "BILL OF SUPPLY";
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(invoiceLabel, MARGIN_MM, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const placeOfSupply = companySettings?.place_of_supply?.trim();
  if (gstEnabled && placeOfSupply) {
    doc.text(`Place of Supply: ${placeOfSupply}`, MARGIN_MM, y);
    y += 5;
  }

  // Invoice details
  doc.setFontSize(9);
  if (invoice.invoice_number) {
    doc.text(`# ${invoice.invoice_number}`, MARGIN_MM, y);
    y += 5;
  }
  const billDateTime = formatBillDateTime(new Date());
  doc.text(`Date: ${billDateTime}`, MARGIN_MM, y);
  y += 5;
  if (invoice.customer_phone) {
    doc.text(`Phone: ${invoice.customer_phone}`, MARGIN_MM, y);
    y += 5;
  }
  if (invoice.customer_name) {
    doc.text(`Customer: ${invoice.customer_name}`, MARGIN_MM, y);
    y += 5;
  }
  if (invoice.customer_address) {
    doc.text(`Address: ${invoice.customer_address}`, MARGIN_MM, y);
    y += 5;
  }
  const customerGstinEnabled =
    companySettings?.customer_gstin_enabled === "true";
  const customerGstin = (invoice as { customer_gstin?: string })
    ?.customer_gstin;
  if (customerGstinEnabled && customerGstin) {
    doc.text(`Customer GSTIN: ${customerGstin}`, MARGIN_MM, y);
    y += 5;
  }

  const useGstLayout = gstEnabled && anyLineHasGst;
  const columns = useGstLayout
    ? [
        ...(hasHsn ? ["HSN"] : []),
        "Product",
        "Qty",
        "Unit",
        "Rate/unit",
        "Taxable",
        "CGST",
        "SGST",
        "Total",
      ].filter(Boolean)
    : ["Product", "Qty", "Unit", "Rate/unit", "Amt"];

  const body = useGstLayout
    ? lines.map((line) => {
        const amount = line.amount ?? line.quantity * line.price;
        const gstRate = (line as { gst_rate?: number }).gst_rate ?? 0;
        const taxable =
          (line as { taxable_amount?: number }).taxable_amount ?? amount;
        const cgst = (line as { cgst_amount?: number }).cgst_amount ?? 0;
        const sgst = (line as { sgst_amount?: number }).sgst_amount ?? 0;
        const hsn = (line as { hsn_code?: string | null }).hsn_code ?? "";
        const priceUnit =
          (line as { price_unit?: string | null }).price_unit ?? line.unit;
        const row = [
          ...(hasHsn ? [hsn] : []),
          line.product_name ?? "",
          formatDecimal(line.quantity),
          unitToShort(line.unit, invoiceUnits),
          PDF_RUPEE +
            formatDecimal(line.price) +
            "/" +
            unitToShort(priceUnit, invoiceUnits) +
            (gstRate ? ` (${gstRate}%)` : ""),
          PDF_RUPEE + formatDecimal(taxable),
          PDF_RUPEE + formatDecimal(cgst),
          PDF_RUPEE + formatDecimal(sgst),
          PDF_RUPEE + formatDecimal(amount),
        ];
        return row;
      })
    : lines.map((line) => {
        const amount = line.amount ?? line.quantity * line.price;
        const priceUnit =
          (line as { price_unit?: string | null }).price_unit ?? line.unit;
        return [
          line.product_name ?? "",
          formatDecimal(line.quantity),
          unitToShort(line.unit, invoiceUnits),
          PDF_RUPEE +
            formatDecimal(line.price) +
            "/" +
            unitToShort(priceUnit, invoiceUnits),
          PDF_RUPEE + formatDecimal(amount),
        ];
      });

  const colCount = columns.length;
  const colWidth = CONTENT_WIDTH_MM / colCount;
  const columnStyles: Record<number, object> = {};
  for (let i = 0; i < colCount; i++) {
    columnStyles[i] = {
      cellWidth: colWidth,
      fontSize: 9,
      halign: i >= 1 && i < colCount - 1 ? "right" : "left",
    };
  }
  if (!useGstLayout) {
    columnStyles[1] = { ...columnStyles[1], halign: "right" };
    columnStyles[3] = { ...columnStyles[3], halign: "right" };
    columnStyles[4] = { ...columnStyles[4], halign: "right" };
  }

  autoTable(doc, {
    startY: y,
    head: [columns],
    body,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    tableWidth: CONTENT_WIDTH_MM,
    columnStyles: useGstLayout
      ? columnStyles
      : {
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
  const taxableTotal = useGstLayout
    ? lines.reduce(
        (s, l) =>
          s +
          ((l as { taxable_amount?: number }).taxable_amount ?? l.amount ?? 0),
        0
      )
    : total;
  const cgstTotal = useGstLayout
    ? lines.reduce(
        (s, l) => s + ((l as { cgst_amount?: number }).cgst_amount ?? 0),
        0
      )
    : 0;
  const sgstTotal = useGstLayout
    ? lines.reduce(
        (s, l) => s + ((l as { sgst_amount?: number }).sgst_amount ?? 0),
        0
      )
    : 0;

  if (finalY + (useGstLayout ? 25 : 12) > PAGE_HEIGHT_MM - MARGIN_MM) {
    doc.addPage([PAGE_WIDTH_MM, PAGE_HEIGHT_MM], "portrait");
    y = MARGIN_MM;
  } else {
    y = finalY + 3;
  }
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  y += 3;
  if (useGstLayout) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Taxable Amount: ${PDF_RUPEE}${formatDecimal(taxableTotal)}`,
      MARGIN_MM,
      y
    );
    y += 5;
    doc.text(`CGST: ${PDF_RUPEE}${formatDecimal(cgstTotal)}`, MARGIN_MM, y);
    y += 5;
    doc.text(`SGST: ${PDF_RUPEE}${formatDecimal(sgstTotal)}`, MARGIN_MM, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.text(`Grand Total: ${PDF_RUPEE}${formatDecimal(total)}`, MARGIN_MM, y);
    y += 6;
    if (gstEnabled) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const words = amountInWords(total);
      const wordsLines = doc.splitTextToSize(words, CONTENT_WIDTH_MM);
      doc.text(wordsLines, MARGIN_MM, y);
      y += wordsLines.length * 4 + 2;
    }
  } else {
    doc.text(`Total: ${PDF_RUPEE}${formatDecimal(total)}`, MARGIN_MM, y);
  }

  const safeNum = invoice.invoice_number
    ? sanitizeForFilename(invoice.invoice_number)
    : `invoice-${invoice.id}`;
  downloadPdf(doc, `invoice-${safeNum}-${formatDateForFile(new Date())}.pdf`);
}
