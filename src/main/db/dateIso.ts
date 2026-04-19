export function formatDateToIsoLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftIsoDateByDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shiftedDate = new Date(year, (month ?? 1) - 1, day ?? 1);
  shiftedDate.setDate(shiftedDate.getDate() + days);
  return formatDateToIsoLocal(shiftedDate);
}
