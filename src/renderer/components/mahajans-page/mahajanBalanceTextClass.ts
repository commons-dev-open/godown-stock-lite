export function mahajanNetBalanceTextClass(total: number): string {
  if (total > 0) {
    return "font-medium text-[var(--color-danger)]";
  }
  if (total < 0) {
    return "font-medium text-[var(--color-success)]";
  }
  return "font-medium text-[var(--color-text-primary)]";
}
