// A negative Amount Due means the reader paid more than they owed — the
// ledger already carries this forward correctly (it just offsets the next
// charge automatically), this only controls how it's *displayed* so it reads
// as "Credit: ₹50" instead of a confusing "₹-50".
export function formatAmountDue(amount: number): string {
  return amount < 0 ? `Credit: ₹${Math.abs(amount).toFixed(2)}` : `₹${amount.toFixed(2)}`;
}
