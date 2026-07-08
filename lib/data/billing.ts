import "server-only";
import { and, desc, eq, gt, gte, ilike, lte, max, notInArray, or, sql } from "drizzle-orm";
import { requireAdmin, requireAppUser, type AppUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  readers,
  centers,
  cities,
  units,
  appUsers,
  cityPricing,
  pricingOverrides,
  attendance,
  payments,
  readerBillingLedger,
} from "@/lib/db/schema";
import { assertCenterInScope } from "./readers";
import { calculateMonthCharge, type PricePeriod, type AttendanceStatus } from "@/lib/billing/calculate";
import { postLedgerEntry } from "@/lib/billing/ledger";

async function getReaderBillingContext(readerId: number) {
  const [row] = await db
    .select({
      centerId: readers.centerId,
      cityId: centers.cityId,
      unitId: cities.unitId,
      subscriptionStartDate: readers.subscriptionStartDate,
    })
    .from(readers)
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
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

// "Day Rates" — see lib/db/schema.ts's pricingOverrides. Fetches every
// active override once and resolves the Center/Unit/Global values for one
// reader's context; cheap enough to call per-reader since this table stays
// small (one row per configured override, not per reader).
async function getPriceOverridesFor(centerId: number, unitId: number) {
  const rows = await db.select().from(pricingOverrides).where(eq(pricingOverrides.active, true));
  const find = (scope: "center" | "unit" | "global", scopeId: number | null) =>
    rows.find((r) => r.scope === scope && r.scopeId === scopeId);

  const centerOverride = find("center", centerId)?.dailyPrice;
  const unitOverride = find("unit", unitId)?.dailyPrice;
  const globalDefault = find("global", null)?.dailyPrice;
  return {
    centerOverride: centerOverride != null ? Number(centerOverride) : null,
    unitOverride: unitOverride != null ? Number(unitOverride) : null,
    globalDefault: globalDefault != null ? Number(globalDefault) : null,
  };
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

  const [pricingHistory, attendanceMap, overrides] = await Promise.all([
    getCityPricingHistory(context.cityId),
    getAttendanceMap(readerId, monthStart, today),
    getPriceOverridesFor(context.centerId, context.unitId),
  ]);

  const amount = calculateMonthCharge({
    billingPeriod,
    subscriptionStartDate: context.subscriptionStartDate,
    attendance: attendanceMap,
    pricingHistory,
    ...overrides,
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
      unitId: cities.unitId,
      subscriptionStartDate: readers.subscriptionStartDate,
    })
    .from(readers)
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
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
  const overrideRows = await db.select().from(pricingOverrides).where(eq(pricingOverrides.active, true));
  const globalDefaultRow = overrideRows.find((r) => r.scope === "global");
  const globalDefault = globalDefaultRow ? Number(globalDefaultRow.dailyPrice) : null;

  const monthStart = `${billingPeriod}-01`;
  let chargedCount = 0;

  await db.transaction(async (tx) => {
    for (const reader of eligibleReaders) {
      const attendanceMap = await getAttendanceMap(reader.id, monthStart, monthEnd);
      const centerOverrideRow = overrideRows.find((r) => r.scope === "center" && r.scopeId === reader.centerId);
      const unitOverrideRow = overrideRows.find((r) => r.scope === "unit" && r.scopeId === reader.unitId);
      const amount = calculateMonthCharge({
        billingPeriod,
        subscriptionStartDate: reader.subscriptionStartDate,
        attendance: attendanceMap,
        pricingHistory: pricingByCityId.get(reader.cityId) ?? [],
        today: monthEnd, // force full-month billing regardless of when Close Month is actually clicked
        centerOverride: centerOverrideRow ? Number(centerOverrideRow.dailyPrice) : null,
        unitOverride: unitOverrideRow ? Number(unitOverrideRow.dailyPrice) : null,
        globalDefault,
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

function scopeToCenters(user: AppUser) {
  if (user.role === "admin") return undefined;
  if (user.centerIds.length === 0) return sql`false`;
  return sql`${readers.centerId} in (${sql.join(user.centerIds, sql`, `)})`;
}

export type BillingCycleFilters = {
  search?: string;
  centerId?: number;
  billingPeriod?: string; // 'YYYY-MM'
  status?: "due" | "paid";
};

// Cross-reader "All Payment Cycles" style view — one row per reader per
// closed billing period. Our data model doesn't track per-period paid
// amounts the way a discrete "payment cycle" record would (payments reduce
// a running balance, not a specific period's due amount), so "status" here
// is necessarily an approximation: it reflects the reader's *current*
// overall outstanding balance, not whether this specific period was paid.
// Good enough for "who still owes something" triage; not a per-period
// reconciliation tool.
export async function listBillingCycles(filters: BillingCycleFilters = {}) {
  const user = await requireAppUser();

  const conditions = [eq(readerBillingLedger.entryType, "monthly_charge"), scopeToCenters(user)];
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(ilike(readers.name, term), ilike(readers.mobile, term), ilike(readers.readerCode, term)));
  }
  if (filters.centerId) conditions.push(eq(readers.centerId, filters.centerId));
  if (filters.billingPeriod) conditions.push(eq(readerBillingLedger.billingPeriod, filters.billingPeriod));
  if (filters.status === "due") conditions.push(gt(readers.outstandingBalance, "0"));
  if (filters.status === "paid") conditions.push(lte(readers.outstandingBalance, "0"));

  const rows = await db
    .select({
      id: readerBillingLedger.id,
      readerId: readers.id,
      readerName: readers.name,
      readerCode: readers.readerCode,
      unitName: units.name,
      centerName: centers.name,
      pocName: appUsers.name,
      amount: readerBillingLedger.amount,
      outstandingBalance: readers.outstandingBalance,
      billingPeriod: readerBillingLedger.billingPeriod,
    })
    .from(readerBillingLedger)
    .innerJoin(readers, eq(readerBillingLedger.readerId, readers.id))
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .innerJoin(units, eq(cities.unitId, units.id))
    .leftJoin(appUsers, eq(readers.assignedPocId, appUsers.id))
    .where(and(...conditions.filter((c) => c !== undefined)))
    .orderBy(desc(readerBillingLedger.billingPeriod), desc(readerBillingLedger.id));

  if (rows.length === 0) return [];

  // Separate query (not joined into the above) to avoid join fan-out
  // inflating the charge amounts — see the same lesson already documented
  // for lib/data/reports.ts's getGroupedReport().
  const readerIds = [...new Set(rows.map((r) => r.readerId))];
  const lastPayments = await db
    .select({ readerId: payments.readerId, lastPaymentDate: max(payments.paymentDate) })
    .from(payments)
    .where(sql`${payments.readerId} in (${sql.join(readerIds, sql`, `)})`)
    .groupBy(payments.readerId);
  const lastPaymentByReader = new Map(lastPayments.map((p) => [p.readerId, p.lastPaymentDate]));

  return rows.map((r) => ({ ...r, lastPaymentDate: lastPaymentByReader.get(r.readerId) ?? null }));
}
