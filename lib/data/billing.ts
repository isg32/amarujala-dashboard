import "server-only";
import { and, eq, gte, lte, notInArray } from "drizzle-orm";
import { requireAdmin, requireAppUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { readers, centers, cityPricing, attendance, readerBillingLedger } from "@/lib/db/schema";
import { assertCenterInScope } from "./readers";
import { calculateMonthCharge, type PricePeriod, type AttendanceStatus } from "@/lib/billing/calculate";
import { postLedgerEntry } from "@/lib/billing/ledger";

async function getReaderBillingContext(readerId: number) {
  const [row] = await db
    .select({
      centerId: readers.centerId,
      cityId: centers.cityId,
      subscriptionStartDate: readers.subscriptionStartDate,
    })
    .from(readers)
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .where(eq(readers.id, readerId));
  if (!row) throw new Error("Reader not found.");
  return row;
}

async function getCityPricingHistory(cityId: number): Promise<PricePeriod[]> {
  const rows = await db
    .select({ price: cityPricing.price, effectiveFrom: cityPricing.effectiveFrom })
    .from(cityPricing)
    .where(eq(cityPricing.cityId, cityId));
  return rows.map((r) => ({ price: Number(r.price), effectiveFrom: r.effectiveFrom }));
}

async function getAttendanceMap(
  readerId: number,
  periodStart: string,
  periodEnd: string
): Promise<Record<string, AttendanceStatus>> {
  const rows = await db
    .select({ attendanceDate: attendance.attendanceDate, status: attendance.status })
    .from(attendance)
    .where(
      and(eq(attendance.readerId, readerId), gte(attendance.attendanceDate, periodStart), lte(attendance.attendanceDate, periodEnd))
    );
  return Object.fromEntries(rows.map((r) => [r.attendanceDate, r.status]));
}

// Live, provisional total for the current (still open) billing period —
// recomputed on every read, never written to the ledger. Only the
// month-close action below writes an immutable monthly_charge entry.
export async function getCurrentMonthProvisional(readerId: number) {
  const user = await requireAppUser();
  const context = await getReaderBillingContext(readerId);
  assertCenterInScope(user, context.centerId);

  const billingPeriod = new Date().toISOString().slice(0, 7);
  const monthStart = `${billingPeriod}-01`;
  const today = new Date().toISOString().slice(0, 10);

  const [pricingHistory, attendanceMap] = await Promise.all([
    getCityPricingHistory(context.cityId),
    getAttendanceMap(readerId, monthStart, today),
  ]);

  const amount = calculateMonthCharge({
    billingPeriod,
    subscriptionStartDate: context.subscriptionStartDate,
    attendance: attendanceMap,
    pricingHistory,
  });

  return { billingPeriod, amount };
}

export async function listLedgerForReader(readerId: number) {
  const user = await requireAppUser();
  const context = await getReaderBillingContext(readerId);
  assertCenterInScope(user, context.centerId);

  return db
    .select({
      id: readerBillingLedger.id,
      entryType: readerBillingLedger.entryType,
      amount: readerBillingLedger.amount,
      billingPeriod: readerBillingLedger.billingPeriod,
      description: readerBillingLedger.description,
      createdAt: readerBillingLedger.createdAt,
    })
    .from(readerBillingLedger)
    .where(eq(readerBillingLedger.readerId, readerId))
    .orderBy(readerBillingLedger.createdAt);
}

export interface CloseMonthResult {
  billingPeriod: string;
  chargedCount: number;
  skippedAlreadyClosedCount: number;
}

// Admin-triggered (no cron dependency for v1). Writes one immutable
// monthly_charge ledger entry per reader for billingPeriod, skipping any
// reader who already has one for that period (idempotent — safe to
// re-trigger). The partial unique index on (reader_id, billing_period)
// backs this up at the DB level as a second line of defense.
export async function closeMonth(billingPeriod: string): Promise<CloseMonthResult> {
  const user = await requireAdmin();

  const monthEnd = billingPeriod + "-31"; // loose upper bound, date comparisons below don't need exactness
  const alreadyCharged = await db
    .select({ readerId: readerBillingLedger.readerId })
    .from(readerBillingLedger)
    .where(and(eq(readerBillingLedger.entryType, "monthly_charge"), eq(readerBillingLedger.billingPeriod, billingPeriod)));
  const alreadyChargedIds = alreadyCharged.map((r) => r.readerId);

  const eligibleReaders = await db
    .select({
      id: readers.id,
      centerId: readers.centerId,
      cityId: centers.cityId,
      subscriptionStartDate: readers.subscriptionStartDate,
    })
    .from(readers)
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .where(
      and(
        lte(readers.subscriptionStartDate, monthEnd),
        alreadyChargedIds.length > 0 ? notInArray(readers.id, alreadyChargedIds) : undefined
      )
    );

  const cityIds = [...new Set(eligibleReaders.map((r) => r.cityId))];
  const pricingByCityId = new Map<number, PricePeriod[]>(
    await Promise.all(cityIds.map(async (cityId) => [cityId, await getCityPricingHistory(cityId)] as const))
  );

  const monthStart = `${billingPeriod}-01`;
  let chargedCount = 0;

  await db.transaction(async (tx) => {
    for (const reader of eligibleReaders) {
      const attendanceMap = await getAttendanceMap(reader.id, monthStart, monthEnd);
      const amount = calculateMonthCharge({
        billingPeriod,
        subscriptionStartDate: reader.subscriptionStartDate,
        attendance: attendanceMap,
        pricingHistory: pricingByCityId.get(reader.cityId) ?? [],
        today: monthEnd, // force full-month billing regardless of when Close Month is actually clicked
      });
      // Always post, even for a $0 charge: this is what makes the period
      // "closed" for this reader (backs the idempotency check above) and
      // keeps the audit trail explicit rather than silently absent.
      await postLedgerEntry(
        {
          readerId: reader.id,
          entryType: "monthly_charge",
          amount,
          billingPeriod,
          description: `Month close ${billingPeriod}`,
          createdBy: user.id,
        },
        tx
      );
      chargedCount++;
    }
  });

  return { billingPeriod, chargedCount, skippedAlreadyClosedCount: alreadyChargedIds.length };
}
