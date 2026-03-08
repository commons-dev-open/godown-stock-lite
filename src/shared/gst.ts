export const GST_SLABS = [0, 5, 12, 18, 28] as const;
export type GstSlab = (typeof GST_SLABS)[number];

export interface GstLineResult {
  taxable_amount: number;
  gst_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  total_amount: number;
}

/**
 * Compute GST for an invoice line.
 * @param gross - Pre-GST amount if exclusive, or MRP total if inclusive
 * @param gst_rate - GST rate (0, 5, 12, 18, 28)
 * @param inclusive - true = gross includes GST (MRP), false = GST added on top
 */
export function computeLineGst(
  gross: number,
  gst_rate: number,
  inclusive: boolean
): GstLineResult {
  const taxable = inclusive ? gross / (1 + gst_rate / 100) : gross;
  const gst_amount = r2(taxable * (gst_rate / 100));
  const half = r2(gst_amount / 2);
  return {
    taxable_amount: r2(taxable),
    gst_amount,
    cgst_amount: half,
    sgst_amount: r2(gst_amount - half),
    total_amount: r2(taxable + gst_amount),
  };
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function toWords(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim();
  if (n < 1000)
    return `${ONES[Math.floor(n / 100)]} Hundred ${toWords(n % 100)}`.trim();
  if (n < 100_000)
    return `${toWords(Math.floor(n / 1000))} Thousand ${toWords(n % 1000)}`.trim();
  if (n < 10_000_000)
    return `${toWords(Math.floor(n / 100_000))} Lakh ${toWords(n % 100_000)}`.trim();
  return `${toWords(Math.floor(n / 10_000_000))} Crore ${toWords(n % 10_000_000)}`.trim();
}

/**
 * Indian numbering: lakhs/crores.
 * e.g. 1050.50 → "Rupees One Thousand Fifty and Paise Fifty Only"
 */
export function amountInWords(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);
  const rStr = rupees === 0 ? "Zero" : toWords(rupees);
  if (paise === 0) {
    return `Rupees ${rStr} Only`;
  }
  const pStr = paise < 20 ? ONES[paise] : `${TENS[Math.floor(paise / 10)]} ${ONES[paise % 10]}`.trim();
  return `Rupees ${rStr} and Paise ${pStr} Only`;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
