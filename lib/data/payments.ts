import "server-only";
import { randomBytes } from "crypto";
import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { requireAdmin, requireAppUser, type AppUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { payments, readers, centers, cities, paymentIntents, coupons } from "@/lib/db/schema";
import { assertCenterInScope } from "./readers";
import { postLedgerEntry } from "@/lib/billing/ledger";
import { PAYU_GATEWAY_ENABLED } from "@/lib/payu/config";
import { applyCoupon } from "./coupons";
import { getAmountDue } from "./billing";
import { sendPaymentConfirmationSms } from "@/lib/sms/send-reminder";

export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "razorpay" | "payu" | "other";

function scopeToCenters(user: AppUser) {
  if (user.role === "admin") return undefined;
  if (user.centerIds.length === 0) return sql`false`;
  return inArray(readers.centerId, user.centerIds);
}

export interface RecordPaymentInput {
  readerId: number;
  amount: number;
  method: PaymentMethod;
  methodOtherLabel?: string;
  transactionReference?: string;
  remarks?: string;
  paymentDate: string;
  /** Manual methods only — see payments.inProcess in lib/db/schema.ts. */
  inProcess?: boolean;
  /** Optional coupon to apply before recording the payment (admin-only). */
  couponId?: number;
}

// Available to both roles (AU POCs can "Record payments" per the FRD),
// center-scoped. Writes the payment row and the offsetting ledger entry
// (negative — decreases what's owed) in one transaction. If a coupon is
// provided it is applied first (admin-only — POCs cannot apply coupons).
export async function recordPayment(input: RecordPaymentInput) {
  const user = await requireAppUser();
  if (user.role === "au_poc" && !user.permissions.canRecordPayments) {
    throw new Error("You don't have permission to record payments. Contact an Administrator.");
  }
  const [reader] = await db.select({ id: readers.id, centerId: readers.centerId, name: readers.name, mobile: readers.mobile }).from(readers).where(eq(readers.id, input.readerId));
  if (!reader) throw new Error("Reader not found.");
  assertCenterInScope(user, reader.centerId);

  // POCs cannot back-date payments — if a correction is needed they must
  // contact an Administrator to record it.
  if (user.role === "au_poc") {
    const today = new Date().toISOString().slice(0, 10);
    if (input.paymentDate < today) {
      throw new Error(
        "Back-date payment recording is restricted to Administrators. " +
        "Please contact an Administrator if a correction is needed."
      );
    }
  }

  if (input.couponId) {
    // applyCoupon internally calls requireAdmin() — POCs cannot pass a coupon.
    await applyCoupon(input.readerId, input.couponId, "Applied during payment recording");
  }

  const { id } = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(payments)
      .values({
        readerId: input.readerId,
        amount: input.amount.toFixed(2),
        method: input.method,
        methodOtherLabel: input.methodOtherLabel,
        transactionReference: input.transactionReference,
        remarks: input.remarks,
        paymentDate: input.paymentDate,
        recordedBy: user.id,
        inProcess: input.inProcess ?? false,
      })
      .returning({ id: payments.id });

    await postLedgerEntry(
      {
        readerId: input.readerId,
        entryType: "payment",
        amount: -input.amount,
        entryDate: input.paymentDate,
        referenceId: inserted.id,
        description: `Payment via ${input.method}`,
        createdBy: user.id,
      },
      tx
    );

    return { id: inserted.id };
  });

  if (!input.inProcess) {
    sendPaymentConfirmationSms(
      { name: reader.name, mobile: reader.mobile },
      input.amount.toFixed(2),
      input.transactionReference ?? `PAY-${id}`,
      input.paymentDate
    );
  }

  return { id };
}

// Admin-only: corrects a mis-entered or duplicate payment by posting an
// offsetting ledger adjustment (adds the amount back to what's owed) and
// flags the payment row so it can't be reversed twice. The original payment
// row is never deleted or mutated beyond the flag — full history stays intact.
export async function reversePayment(paymentId: number, reason?: string) {
  const user = await requireAppUser();
  if (user.role !== "admin") throw new Error("Only Administrators can reverse a payment.");

  const [payment] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!payment) throw new Error("Payment not found.");
  if (payment.reversed) throw new Error("This payment has already been reversed.");

  await db.transaction(async (tx) => {
    await tx.update(payments).set({ reversed: true }).where(eq(payments.id, paymentId));
    await postLedgerEntry(
      {
        readerId: payment.readerId,
        entryType: "adjustment",
        amount: Number(payment.amount),
        referenceId: paymentId,
        description: `Reversal of payment #${paymentId}${reason ? `: ${reason}` : ""}`,
        createdBy: user.id,
      },
      tx
    );
  });
}

// Gated by PAYU_GATEWAY_ENABLED — see lib/payu/config.ts for why.
// Creates a pending payment_intents row and returns the public /pay URL a
// reader can open unauthenticated to complete a real PayU transaction. The
// PayU webhook (markPaymentIntentResult) is what posts the ledger entry once
// the reader actually pays, so the dashboard's outstanding balance reflects
// it automatically on the reader's next page load — no separate sync step.
//
// Defaults to the reader's exact outstanding balance, but an admin can
// override that with any amount before sending (e.g. a negotiated partial
// settlement) — amountOverride wins outright, applied after any voucher
// discount. An optional voucher (existing active coupon) discounts the
// balance before that. Every check that can fail happens *before* the
// voucher is applied — gateway disabled, reader not found, coupon invalid,
// or the discount being large enough to leave nothing to collect — so a
// failed send never leaves a coupon silently consumed with no link actually
// sent.
export async function createPaymentLink(
  readerId: number,
  options: { voucherCouponId?: number; amountOverride?: number } = {}
) {
  const user = await requireAppUser();
  if (!PAYU_GATEWAY_ENABLED) {
    throw new Error("PayU payments are disabled. Set PAYU_GATEWAY_ENABLED=true after testing the flow to go live.");
  }

  const [reader] = await db.select().from(readers).where(eq(readers.id, readerId));
  if (!reader) throw new Error("Reader not found.");

  // Live amount due (posted ledger balance + today's unbilled provisional
  // charge) — reader.outstandingBalance alone would miss everything accrued
  // since the last Close Subscription/historical close, which is most of it
  // now that billing doesn't require a periodic close.
  let balance = await getAmountDue(readerId);

  if (options.voucherCouponId) {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, options.voucherCouponId));
    if (!coupon || !coupon.active) throw new Error("Voucher not found or inactive.");
    const discountAmount = Number(coupon.discountAmount);
    if (discountAmount >= balance) {
      throw new Error(`This voucher (₹${discountAmount}) would leave nothing to collect on a ₹${balance} balance.`);
    }

    await applyCoupon(readerId, options.voucherCouponId, "Applied to payment link");
    balance -= discountAmount;
  }

  if (options.amountOverride != null) {
    if (options.amountOverride <= 0) throw new Error("The payment link amount must be greater than zero.");
    balance = options.amountOverride;
  }

  if (balance <= 0) throw new Error("This reader has no outstanding balance to collect.");

  const txnId = `TX_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const amount = balance.toFixed(2);
  await db.insert(paymentIntents).values({
    readerId,
    txnId,
    amount,
    createdBy: user.id,
  });

  // `amount` is the real final link amount (after voucher/override) —
  // `reader.outstandingBalance` is a stale snapshot from before any of that
  // and must never be used for what the SMS says is owed.
  return { txnId, reader, amount };
}

// The following three functions are the one deliberate exception to this
// file's requireAdmin()/requireAppUser() convention: they back app/pay/*
// and the PayU webhook, which by nature have no logged-in session (the
// reader opening the link, and PayU's own server, are both unauthenticated
// callers). The random, unguessable txnId is the bearer credential instead
// — same trust model as a password-reset link. Never add a lookup here that
// takes a bare readerId/paymentIntent id without going through a txnId.

export async function getPaymentIntentByTxnId(txnId: string) {
  const [intent] = await db.select().from(paymentIntents).where(eq(paymentIntents.txnId, txnId));
  if (!intent) return null;
  const [reader] = await db.select().from(readers).where(eq(readers.id, intent.readerId));
  if (!reader) return null;
  return { intent, reader };
}

export async function markPaymentIntentResult(
  txnId: string,
  status: "success" | "failed",
  recordPaymentAmount?: number
) {
  const [intent] = await db.select().from(paymentIntents).where(eq(paymentIntents.txnId, txnId));
  if (!intent) throw new Error("Payment intent not found.");
  if (intent.status === "success") return { alreadyProcessed: true, intent };

  if (status === "failed") {
    await db.update(paymentIntents).set({ status: "failed" }).where(eq(paymentIntents.txnId, txnId));
    return { alreadyProcessed: false, intent };
  }

  const paymentDate = new Date().toISOString().slice(0, 10);

  await db.transaction(async (tx) => {
    await tx
      .update(paymentIntents)
      .set({ status: "success", paidAt: new Date() })
      .where(eq(paymentIntents.txnId, txnId));

    const [payment] = await tx
      .insert(payments)
      .values({
        readerId: intent.readerId,
        amount: intent.amount,
        method: "payu",
        transactionReference: txnId,
        paymentDate,
        recordedBy: intent.createdBy,
      })
      .returning({ id: payments.id });

    await postLedgerEntry(
      {
        readerId: intent.readerId,
        entryType: "payment",
        amount: -(recordPaymentAmount ?? Number(intent.amount)),
        entryDate: paymentDate,
        referenceId: payment.id,
        description: `PayU payment (txn ${txnId})`,
        createdBy: intent.createdBy,
      },
      tx
    );
  });

  const [reader] = await db.select({ name: readers.name, mobile: readers.mobile }).from(readers).where(eq(readers.id, intent.readerId));
  if (reader) {
    sendPaymentConfirmationSms(
      reader,
      (recordPaymentAmount ?? Number(intent.amount)).toFixed(2),
      txnId,
      paymentDate
    );
  }

  return { alreadyProcessed: false, intent };
}

export async function listPaymentsForReader(readerId: number) {
  const user = await requireAppUser();
  const [reader] = await db.select({ centerId: readers.centerId }).from(readers).where(eq(readers.id, readerId));
  if (!reader) throw new Error("Reader not found.");
  assertCenterInScope(user, reader.centerId);

  return db
    .select()
    .from(payments)
    .where(eq(payments.readerId, readerId))
    .orderBy(desc(payments.paymentDate), desc(payments.id));
}

export type PaymentTransactionFilters = {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  centerId?: number;
  method?: PaymentMethod;
};

// Centralized cross-reader transaction view (FRD §17) for daily-collection
// reconciliation — scoped the same way the reader directory is.
export async function listPaymentTransactions(filters: PaymentTransactionFilters = {}) {
  const user = await requireAppUser();

  const conditions = [scopeToCenters(user)];
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(ilike(readers.name, term), ilike(readers.mobile, term), ilike(readers.readerCode, term)));
  }
  if (filters.dateFrom) conditions.push(gte(payments.paymentDate, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(payments.paymentDate, filters.dateTo));
  if (filters.centerId) conditions.push(eq(readers.centerId, filters.centerId));
  if (filters.method) conditions.push(eq(payments.method, filters.method));

  return db
    .select({
      id: payments.id,
      amount: payments.amount,
      method: payments.method,
      transactionReference: payments.transactionReference,
      paymentDate: payments.paymentDate,
      readerId: payments.readerId,
      readerName: readers.name,
      readerCode: readers.readerCode,
      centerName: centers.name,
      cityName: cities.name,
      reversed: payments.reversed,
      inProcess: payments.inProcess,
    })
    .from(payments)
    .innerJoin(readers, eq(payments.readerId, readers.id))
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .where(and(...conditions))
    .orderBy(desc(payments.paymentDate), desc(payments.id));
}

export type PaymentIntentFilters = {
  search?: string;
  status?: "pending" | "success" | "failed";
  centerId?: number;
};

// Admin-only view of payment_intents — the links actually sent to readers
// (via createPaymentLink), independent of whether they were ever paid.
// "paid" (status success) rows carry a `payment` object with the resulting
// payments.id so the UI can offer Reverse the same way the /payments page
// does for any other payment.
export async function listPaymentIntents(filters: PaymentIntentFilters = {}) {
  await requireAdmin();

  const conditions = [];
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(ilike(readers.name, term), ilike(readers.mobile, term), ilike(readers.readerCode, term)));
  }
  if (filters.status) conditions.push(eq(paymentIntents.status, filters.status));
  if (filters.centerId) conditions.push(eq(readers.centerId, filters.centerId));

  const rows = await db
    .select({
      id: paymentIntents.id,
      txnId: paymentIntents.txnId,
      amount: paymentIntents.amount,
      status: paymentIntents.status,
      createdAt: paymentIntents.createdAt,
      paidAt: paymentIntents.paidAt,
      readerId: readers.id,
      readerName: readers.name,
      readerCode: readers.readerCode,
      centerName: centers.name,
    })
    .from(paymentIntents)
    .innerJoin(readers, eq(paymentIntents.readerId, readers.id))
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(paymentIntents.createdAt));

  const successTxnIds = rows.filter((r) => r.status === "success").map((r) => r.txnId);
  const paymentRows =
    successTxnIds.length > 0
      ? await db
          .select({ id: payments.id, transactionReference: payments.transactionReference, reversed: payments.reversed })
          .from(payments)
          .where(inArray(payments.transactionReference, successTxnIds))
      : [];
  const paymentByTxnId = new Map(paymentRows.map((p) => [p.transactionReference, { id: p.id, reversed: p.reversed }]));

  return rows.map((r) => ({ ...r, payment: paymentByTxnId.get(r.txnId) ?? null }));
}

// For a stale/abandoned link (reader never paid) — lets an admin stop
// treating it as outstanding. No ledger effect: nothing was ever posted for
// a pending intent, so there's nothing to reverse, just a status flip.
export async function markPaymentIntentFailed(intentId: number) {
  await requireAdmin();
  const [intent] = await db.select().from(paymentIntents).where(eq(paymentIntents.id, intentId));
  if (!intent) throw new Error("Payment link not found.");
  if (intent.status !== "pending") {
    throw new Error("Only a pending (unpaid) link can be marked failed.");
  }
  await db.update(paymentIntents).set({ status: "failed" }).where(eq(paymentIntents.id, intentId));
}
