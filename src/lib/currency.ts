export function formatCurrency(amount: number): string {
  return amount < 0 ? `-₱${Math.abs(amount).toFixed(2)}` : `₱${amount.toFixed(2)}`;
}
