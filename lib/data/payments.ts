import "server-only";
import { and, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { requireAppUser, type AppUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { payments, readers, centers, cities } from "@/lib/db/schema";
import { assertCenterInScope } from "./readers";
import { postLedgerEntry } from "@/lib/billing/ledger";

export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "razorpay" | "other";

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
}

// Available to both roles (AU POCs can "Record payments" per the FRD),
// center-scoped. Writes the payment row and the offsetting ledger entry
// (negative — decreases what's owed) in one transaction.
export async function recordPayment(input: RecordPaymentInput) {
  const user = await requireAppUser();
  const [reader] = await db.select({ centerId: readers.centerId }).from(readers).where(eq(readers.id, input.readerId));
  if (!reader) throw new Error("Reader not found.");
  assertCenterInScope(user, reader.centerId);

  return db.transaction(async (tx) => {
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
      })
      .returning({ id: payments.id });

    await postLedgerEntry(
      {
        readerId: input.readerId,
        entryType: "payment",
        amount: -input.amount,
        referenceId: inserted.id,
        description: `Payment via ${input.method}`,
        createdBy: user.id,
      },
      tx
    );

    return { id: inserted.id };
  });
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
    })
    .from(payments)
    .innerJoin(readers, eq(payments.readerId, readers.id))
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .where(and(...conditions))
    .orderBy(desc(payments.paymentDate), desc(payments.id));
}
