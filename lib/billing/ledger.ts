import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { readers, readerBillingLedger } from "@/lib/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type LedgerEntryType = "monthly_charge" | "payment" | "coupon_discount" | "adjustment";

export interface PostLedgerEntryInput {
  readerId: number;
  entryType: LedgerEntryType;
  /**
   * Signed delta applied directly to readers.outstanding_balance. Charges
   * are positive (increase what's owed); payments and coupon discounts are
   * negative (decrease it). This convention is what makes
   * SUM(ledger.amount) == outstanding_balance a valid reconciliation check.
   */
  amount: number;
  billingPeriod?: string;
  /**
   * 'YYYY-MM-DD' — when this financial event actually happened, not when the
   * row was written. Defaults to today. Callers with a real date to backdate
   * to (e.g. Record Payment's paymentDate field) must pass it explicitly, or
   * the ledger will show data-entry time instead of the true payment date.
   */
  entryDate?: string;
  referenceId?: number;
  description?: string;
  createdBy?: string;
}

// The only function allowed to write readers.outstanding_balance — every
// call inserts an immutable ledger row in the same transaction as the
// balance update, so the balance is always auditable/reconcilable. Pass an
// existing `tx` to participate in a caller's transaction (e.g. Close Month
// posting many readers' charges atomically); omit it to run standalone.
export async function postLedgerEntry(input: PostLedgerEntryInput, tx?: Tx) {
  const run = async (executor: Tx) => {
    await executor.insert(readerBillingLedger).values({
      readerId: input.readerId,
      entryType: input.entryType,
      amount: input.amount.toFixed(2),
      billingPeriod: input.billingPeriod,
      entryDate: input.entryDate,
      referenceId: input.referenceId,
      description: input.description,
      createdBy: input.createdBy,
    });

    await executor
      .update(readers)
      .set({ outstandingBalance: sql`${readers.outstandingBalance} + ${input.amount}` })
      .where(eq(readers.id, input.readerId));
  };

  if (tx) {
    await run(tx);
  } else {
    await db.transaction(run);
  }
}
