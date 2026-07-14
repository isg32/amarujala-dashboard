// A negative Amount Due means the reader paid more than they owed — the
// ledger already carries this forward correctly (it just offsets the next
// charge automatically), this only controls how it's *displayed* so it reads
// as "₹50 (overpaid)" instead of a confusing "₹-50" that looks like debt.
export function formatAmountDue(amount: number): string {
  return amount < 0 ? `₹${Math.abs(amount).toFixed(2)} (overpaid)` : `₹${amount.toFixed(2)}`;
}
