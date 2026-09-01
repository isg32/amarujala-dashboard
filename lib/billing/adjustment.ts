// Shared helpers for the admin "custom adjustment" that can be attached to a
// manual payment (RecordPaymentForm) or to Close Subscription. Pure — imported
// by both server actions and client forms.
//
// An adjustment posts one `adjustment` ledger entry whose amount is a SIGNED
// delta on readers.outstanding_balance (see lib/billing/ledger.ts): "reduce"
// = negative (waive / goodwill), "increase" = positive (late fee / back-charge).

export type AdjustmentDirection = "reduce" | "increase";

export const ADJUSTMENT_REASON_PRESETS = ["Closing Adjustment", "Misc Adjustment"] as const;
export const ADJUSTMENT_REASON_OTHER = "Other";

// Preset label, or the typed-in text when the preset is "Other". Returns "" if
// nothing usable was provided — callers treat that as "no reason given".
export function resolveAdjustmentReason(preset: string, other?: string): string {
  if (preset === ADJUSTMENT_REASON_OTHER) return (other ?? "").trim();
  return (preset ?? "").trim();
}

export function signedAdjustmentAmount(absAmount: number, direction: AdjustmentDirection): number {
  const magnitude = Math.abs(absAmount);
  return direction === "reduce" ? -magnitude : magnitude;
}

// How a signed adjustment amount reads in the UI, e.g. "−₹50.00 (reduces balance)".
export function formatSignedAdjustment(signed: number): string {
  const sign = signed < 0 ? "−" : "+";
  const effect = signed < 0 ? "reduces balance" : "increases balance";
  return `${sign}₹${Math.abs(signed).toFixed(2)} (${effect})`;
}
