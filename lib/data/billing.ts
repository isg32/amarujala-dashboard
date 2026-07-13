import "server-only";
import { and, desc, eq, gte, ilike, inArray, lte, max, or, sql } from "drizzle-orm";
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
  calculateCycleCharge,
  getBillingCycle,
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
      status: readers.status,
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

// The one number admin actually cares about: everything already posted to
// the ledger (readers.outstanding_balance) plus today's live, never-posted
// provisional charge — so it's always accurate without needing a Close Month
// click. Negative means the reader is in credit (see reader-table.tsx /
// reader-profile-card.tsx for the "Credit" display treatment).
export async function getAmountDue(readerId: number): Promise<number> {
  const provisional = await getCurrentMonthProvisional(readerId); // does the scope check
  const [row] = await db.select({ outstandingBalance: readers.outstandingBalance }).from(readers).where(eq(readers.id, readerId));
  if (!row) throw new Error("Reader not found.");
  return Math.round((Number(row.outstandingBalance) + provisional.amount) * 100) / 100;
}

// Shared by getCurrentMonthProvisional and closeSubscription: the currently
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

export interface CloseSubscriptionResult {
  billingPeriod: string;
  amount: number;
}

// Replaces the old periodic Close Month / closeReaderCycle ritual — billing
// no longer requires a recurring admin click (see getAmountDue() below for
// the live running total shown everywhere instead). This is only for when a
// reader's subscription actually ends: it posts ONE final ledger charge for
// everything accrued since their last posted monthly_charge (or subscription
// start if they were never billed), then marks them inactive. Idempotent in
// the sense that closing an already-inactive reader is rejected outright
// rather than double-charging them.
export async function closeSubscription(readerId: number): Promise<CloseSubscriptionResult> {
  const user = await requireAdmin();
  const context = await getReaderBillingContext(readerId);
  if (context.status === "inactive") {
    throw new Error("This reader's subscription is already closed.");
  }

  const today = new Date().toISOString().slice(0, 10);

  const [lastCharge] = await db
    .select({ entryDate: readerBillingLedger.entryDate })
    .from(readerBillingLedger)
    .where(and(eq(readerBillingLedger.readerId, readerId), eq(readerBillingLedger.entryType, "monthly_charge")))
    .orderBy(desc(readerBillingLedger.entryDate))
    .limit(1);

  let periodStart = context.subscriptionStartDate;
  if (lastCharge) {
    const d = new Date(lastCharge.entryDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    periodStart = d.toISOString().slice(0, 10);
  }
  if (periodStart > today) periodStart = today; // already fully billed through today; post a $0 close

  const billingPeriod = today.slice(0, 7);

  const [pricingHistory, attendanceMap, overrides] = await Promise.all([
    getCityPricingHistory(context.cityId),
    getAttendanceMap(readerId, periodStart, today),
    getPriceOverridesFor(context.centerId, context.unitId),
  ]);

  const amount = calculateCycleCharge({
    cycleStart: periodStart,
    cycleEnd: today,
    subscriptionStartDate: context.subscriptionStartDate,
    attendance: attendanceMap,
    pricingHistory,
    today,
    unmarkedDefault: unmarkedDefaultFor(periodStart),
    ...overrides,
  });

  await db.transaction(async (tx) => {
    await postLedgerEntry(
      {
        readerId,
        entryType: "monthly_charge",
        amount,
        billingPeriod,
        entryDate: today,
        description: `Subscription closed ${periodStart} – ${today}`,
        createdBy: user.id,
      },
      tx
    );
    await tx.update(readers).set({ status: "inactive" }).where(eq(readers.id, readerId));
  });

  return { billingPeriod, amount };
}

function scopeToCenters(user: AppUser) {
  if (user.role === "admin") return undefined;
  if (user.centerIds.length === 0) return sql`false`;
  return sql`${readers.centerId} in (${sql.join(user.centerIds, sql`, `)})`;
}

export type ReaderAmountDueFilters = {
  search?: string;
  centerId?: number;
  status?: "due" | "paid"; // based on the same live amount this returns, not a stale stored value
};

// Replaces the old ledger-driven "payment cycles" list now that billing
// doesn't require a periodic Close Month click — this is reader-centric (one
// row per reader), with Amount Due computed live the same way getAmountDue()
// does, just batched across every matching reader instead of one at a time:
// city pricing and active overrides are fetched once, and attendance is
// fetched in a single query over a 31-day window (covers every possible
// anchor-day cycleStart) instead of one query per reader.
export async function listReadersWithAmountDue(filters: ReaderAmountDueFilters = {}) {
  const user = await requireAppUser();

  const conditions = [scopeToCenters(user)];
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(or(ilike(readers.name, term), ilike(readers.mobile, term), ilike(readers.readerCode, term)));
  }
  if (filters.centerId) conditions.push(eq(readers.centerId, filters.centerId));

  const rows = await db
    .select({
      id: readers.id,
      readerName: readers.name,
      readerCode: readers.readerCode,
      centerId: readers.centerId,
      cityId: centers.cityId,
      unitId: cities.unitId,
      unitName: units.name,
      centerName: centers.name,
      pocName: appUsers.name,
      subscriptionStartDate: readers.subscriptionStartDate,
      billingAnchorDay: readers.billingAnchorDay,
      outstandingBalance: readers.outstandingBalance,
    })
    .from(readers)
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .innerJoin(units, eq(cities.unitId, units.id))
    .leftJoin(appUsers, eq(readers.assignedPocId, appUsers.id))
    .where(and(...conditions.filter((c) => c !== undefined)));

  if (rows.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const cityIds = [...new Set(rows.map((r) => r.cityId))];
  const pricingByCityId = new Map<number, PricePeriod[]>(
    await Promise.all(cityIds.map(async (cityId) => [cityId, await getCityPricingHistory(cityId)] as const))
  );
  const overrideRows = await db.select().from(pricingOverrides).where(eq(pricingOverrides.active, true));

  const windowStart = new Date(today + "T00:00:00Z");
  windowStart.setUTCDate(windowStart.getUTCDate() - 31);
  const windowStartStr = windowStart.toISOString().slice(0, 10);
  const readerIds = rows.map((r) => r.id);
  const attendanceRows = await db
    .select({ readerId: attendance.readerId, attendanceDate: attendance.attendanceDate, status: attendance.status })
    .from(attendance)
    .where(and(inArray(attendance.readerId, readerIds), gte(attendance.attendanceDate, windowStartStr), lte(attendance.attendanceDate, today)));
  const attendanceByReader = new Map<number, Record<string, AttendanceStatus>>();
  for (const a of attendanceRows) {
    if (!attendanceByReader.has(a.readerId)) attendanceByReader.set(a.readerId, {});
    attendanceByReader.get(a.readerId)![a.attendanceDate] = a.status;
  }

  const lastPayments = await db
    .select({ readerId: payments.readerId, lastPaymentDate: max(payments.paymentDate) })
    .from(payments)
    .where(inArray(payments.readerId, readerIds))
    .groupBy(payments.readerId);
  const lastPaymentByReader = new Map(lastPayments.map((p) => [p.readerId, p.lastPaymentDate]));

  const allRows = rows.map((r) => {
    const { cycleStart, cycleEnd } = currentCycleFor(r.billingAnchorDay, today);
    const overrides = resolveOverridesForContext(overrideRows, r.centerId, r.unitId);
    const provisional = calculateCycleCharge({
      cycleStart,
      cycleEnd,
      subscriptionStartDate: r.subscriptionStartDate,
      attendance: attendanceByReader.get(r.id) ?? {},
      pricingHistory: pricingByCityId.get(r.cityId) ?? [],
      today,
      unmarkedDefault: unmarkedDefaultFor(cycleStart),
      ...overrides,
    });
    const amountDue = Math.round((Number(r.outstandingBalance) + provisional) * 100) / 100;
    return {
      readerId: r.id,
      readerName: r.readerName,
      readerCode: r.readerCode,
      unitName: r.unitName,
      centerName: r.centerName,
      pocName: r.pocName,
      amountDue,
      lastPaymentDate: lastPaymentByReader.get(r.id) ?? null,
    };
  });

  const filtered =
    filters.status === "due"
      ? allRows.filter((r) => r.amountDue > 0)
      : filters.status === "paid"
        ? allRows.filter((r) => r.amountDue <= 0)
        : allRows;

  return filtered.sort((a, b) => b.amountDue - a.amountDue);
}
