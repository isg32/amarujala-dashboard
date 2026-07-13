import "server-only";
import { and, desc, eq, gt, gte, ilike, isNull, lte, max, notInArray, or, sql } from "drizzle-orm";
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
import {
  calculateMonthCharge,
  calculateCycleCharge,
  getBillingCycle,
  daysInMonth,
  type PricePeriod,
  type AttendanceStatus,
} from "@/lib/billing/calculate";
import { postLedgerEntry } from "@/lib/billing/ledger";

// Confirmed 2026-07-14: flip the "unmarked attendance day" default from
// delivered to not_delivered, but only for billing cycles that START on or
// after this date — a cycle already in progress when this shipped keeps the
// old delivered-default for its whole length (so July's live totals don't
// suddenly crater for POCs who were only marking absences). Applies per
// reader-cycle, so custom billingAnchorDay readers cut over individually
// based on their own cycle's start date, not a shared calendar boundary.
const UNMARKED_DEFAULT_CUTOVER_DATE = "2026-07-14";

function unmarkedDefaultFor(cycleStart: string): AttendanceStatus {
  return cycleStart >= UNMARKED_DEFAULT_CUTOVER_DATE ? "not_delivered" : "delivered";
}

async function getReaderBillingContext(readerId: number) {
  const [row] = await db
    .select({
      centerId: readers.centerId,
      cityId: centers.cityId,
      unitId: cities.unitId,
      subscriptionStartDate: readers.subscriptionStartDate,
      billingAnchorDay: readers.billingAnchorDay,
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

type PricingOverrideRow = typeof pricingOverrides.$inferSelect;

// Pure resolution over an already-fetched set of override rows (ongoing +
// one-day-only) for one reader's Center/Unit context — shared by
// getPriceOverridesFor (fetches its own rows, one reader) and closeMonth
// (fetches once, resolves per reader in a loop) so the precedence logic
// only lives in one place.
function resolveOverridesForContext(rows: PricingOverrideRow[], centerId: number, unitId: number) {
  const ongoing = rows.filter((r) => r.forDate == null);
  const dated = rows.filter((r) => r.forDate != null);

  const find = (list: PricingOverrideRow[], scope: "center" | "unit" | "global", scopeId: number | null) =>
    list.find((r) => r.scope === scope && r.scopeId === scopeId);

  const centerOverride = find(ongoing, "center", centerId)?.dailyPrice;
  const unitOverride = find(ongoing, "unit", unitId)?.dailyPrice;
  const globalDefault = find(ongoing, "global", null)?.dailyPrice;

  const specialDayPrices: Record<string, number> = {};
  for (const forDate of new Set(dated.map((r) => r.forDate!))) {
    const dayRows = dated.filter((r) => r.forDate === forDate);
    const winner = find(dayRows, "center", centerId) ?? find(dayRows, "unit", unitId) ?? find(dayRows, "global", null);
    if (winner) specialDayPrices[forDate] = Number(winner.dailyPrice);
  }

  return {
    centerOverride: centerOverride != null ? Number(centerOverride) : null,
    unitOverride: unitOverride != null ? Number(unitOverride) : null,
    globalDefault: globalDefault != null ? Number(globalDefault) : null,
    specialDayPrices,
  };
}

// "Day Rates" — see lib/db/schema.ts's pricingOverrides. Fetches every
// active override once and resolves the Center/Unit/Global values for one
// reader's context; cheap enough to call per-reader since this table stays
// small (one row per configured override, not per reader).
async function getPriceOverridesFor(centerId: number, unitId: number) {
  const rows = await db.select().from(pricingOverrides).where(eq(pricingOverrides.active, true));
  return resolveOverridesForContext(rows, centerId, unitId);
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
// month-close / closeReaderCycle actions below write an immutable
// monthly_charge entry. Readers with a custom billingAnchorDay get their
// own [anchorDay .. anchorDay-1] cycle instead of the calendar month.
export async function getCurrentMonthProvisional(readerId: number) {
  const user = await requireAppUser();
  const context = await getReaderBillingContext(readerId);
  assertCenterInScope(user, context.centerId);

  const today = new Date().toISOString().slice(0, 10);
  const { cycleStart, cycleEnd, billingPeriod } = currentCycleFor(context.billingAnchorDay, today);

  const [pricingHistory, attendanceMap, overrides] = await Promise.all([
    getCityPricingHistory(context.cityId),
    getAttendanceMap(readerId, cycleStart, today),
    getPriceOverridesFor(context.centerId, context.unitId),
  ]);

  const amount = calculateCycleCharge({
    cycleStart,
    cycleEnd,
    subscriptionStartDate: context.subscriptionStartDate,
    attendance: attendanceMap,
    pricingHistory,
    today,
    unmarkedDefault: unmarkedDefaultFor(cycleStart),
    ...overrides,
  });

  return { billingPeriod, cycleStart, cycleEnd, amount };
}

// Shared by getCurrentMonthProvisional and closeReaderCycle: the currently
// open cycle for a reader, calendar-month by default or anchor-day-based if
// set. billingPeriod is the ledger's 'YYYY-MM' label — for anchor-day
// readers this is the cycle's start month, not necessarily today's month.
function currentCycleFor(anchorDay: number | null, referenceDate: string) {
  if (anchorDay == null) {
    const billingPeriod = referenceDate.slice(0, 7);
    return { cycleStart: `${billingPeriod}-01`, cycleEnd: `${billingPeriod}-31`, billingPeriod };
  }
  const { cycleStart, cycleEnd } = getBillingCycle(anchorDay, referenceDate);
  return { cycleStart, cycleEnd, billingPeriod: cycleStart.slice(0, 7) };
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
      entryDate: readerBillingLedger.entryDate,
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
  const [closeYear, closeMonthNum] = billingPeriod.split("-").map(Number);
  const realMonthEnd = `${billingPeriod}-${String(daysInMonth(closeYear, closeMonthNum)).padStart(2, "0")}`;
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
        // Readers on a custom billing-cycle anchor day close individually
        // via closeReaderCycle(), not through this org-wide calendar-month run.
        isNull(readers.billingAnchorDay),
        lte(readers.subscriptionStartDate, monthEnd),
        alreadyChargedIds.length > 0 ? notInArray(readers.id, alreadyChargedIds) : undefined
      )
    );

  const cityIds = [...new Set(eligibleReaders.map((r) => r.cityId))];
  const pricingByCityId = new Map<number, PricePeriod[]>(
    await Promise.all(cityIds.map(async (cityId) => [cityId, await getCityPricingHistory(cityId)] as const))
  );
  const overrideRows = await db.select().from(pricingOverrides).where(eq(pricingOverrides.active, true));

  const monthStart = `${billingPeriod}-01`;
  let chargedCount = 0;

  await db.transaction(async (tx) => {
    for (const reader of eligibleReaders) {
      const attendanceMap = await getAttendanceMap(reader.id, monthStart, monthEnd);
      const overrides = resolveOverridesForContext(overrideRows, reader.centerId, reader.unitId);
      const amount = calculateMonthCharge({
        billingPeriod,
        subscriptionStartDate: reader.subscriptionStartDate,
        attendance: attendanceMap,
        pricingHistory: pricingByCityId.get(reader.cityId) ?? [],
        today: monthEnd, // force full-month billing regardless of when Close Month is actually clicked
        unmarkedDefault: unmarkedDefaultFor(monthStart),
        ...overrides,
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
          entryDate: realMonthEnd,
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

export interface CloseReaderCycleResult {
  billingPeriod: string;
  cycleStart: string;
  cycleEnd: string;
  amount: number;
  alreadyClosed: boolean;
}

// Admin-triggered, per-reader equivalent of closeMonth() for a reader on a
// custom billingAnchorDay — since each such reader's cycle boundary is a
// different date, there's no single shared "period" to close them all at
// once the way the calendar-month readers have. Closes the most recently
// *completed* cycle (the one immediately before the currently open one).
// Idempotent per (reader, billingPeriod) via the same ledger unique index
// closeMonth relies on.
export async function closeReaderCycle(readerId: number): Promise<CloseReaderCycleResult> {
  const user = await requireAdmin();
  const context = await getReaderBillingContext(readerId);
  if (context.billingAnchorDay == null) {
    throw new Error("This reader bills on the calendar month — use Close Month instead.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const currentCycle = getBillingCycle(context.billingAnchorDay, today);
  const dayBeforeCurrentCycle = new Date(currentCycle.cycleStart + "T00:00:00Z");
  dayBeforeCurrentCycle.setUTCDate(dayBeforeCurrentCycle.getUTCDate() - 1);
  const referenceDate = dayBeforeCurrentCycle.toISOString().slice(0, 10);

  const { cycleStart, cycleEnd } = getBillingCycle(context.billingAnchorDay, referenceDate);
  const billingPeriod = cycleStart.slice(0, 7);

  const [existing] = await db
    .select({ id: readerBillingLedger.id })
    .from(readerBillingLedger)
    .where(
      and(
        eq(readerBillingLedger.readerId, readerId),
        eq(readerBillingLedger.entryType, "monthly_charge"),
        eq(readerBillingLedger.billingPeriod, billingPeriod)
      )
    );
  if (existing) return { billingPeriod, cycleStart, cycleEnd, amount: 0, alreadyClosed: true };

  const [pricingHistory, attendanceMap, overrides] = await Promise.all([
    getCityPricingHistory(context.cityId),
    getAttendanceMap(readerId, cycleStart, cycleEnd),
    getPriceOverridesFor(context.centerId, context.unitId),
  ]);

  const amount = calculateCycleCharge({
    cycleStart,
    cycleEnd,
    subscriptionStartDate: context.subscriptionStartDate,
    attendance: attendanceMap,
    pricingHistory,
    today: cycleEnd, // force the full completed cycle regardless of when this is clicked
    unmarkedDefault: unmarkedDefaultFor(cycleStart),
    ...overrides,
  });

  await postLedgerEntry({
    readerId,
    entryType: "monthly_charge",
    amount,
    billingPeriod,
    entryDate: cycleEnd,
    description: `Cycle close ${cycleStart} – ${cycleEnd}`,
    createdBy: user.id,
  });

  return { billingPeriod, cycleStart, cycleEnd, amount, alreadyClosed: false };
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
