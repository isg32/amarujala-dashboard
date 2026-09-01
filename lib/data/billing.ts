import "server-only";
import { and, desc, eq, gte, ilike, inArray, lte, max, or, sql } from "drizzle-orm";
import { requireAppUser, type AppUser } from "@/lib/auth/session";
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

// An unmarked attendance day never bills — it defaults to not_delivered.
// There is no fallback to delivered: if a POC hasn't marked a day, it isn't
// charged. Callers must mark a day delivered explicitly for it to count.
function unmarkedDefaultFor(): AttendanceStatus {
  return "not_delivered";
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

// Returns the day after the last posted period_charge for this reader, or
// the subscriptionStartDate if no period_charge has ever been posted. Used
// by both getAmountDue (for live computation across all unbilled cycles) and
// closeSubscription (to know where the final charge should begin).
async function getUnbilledPeriodStart(readerId: number, subscriptionStartDate: string): Promise<string> {
  const [lastCharge] = await db
    .select({ entryDate: readerBillingLedger.entryDate })
    .from(readerBillingLedger)
    .where(and(eq(readerBillingLedger.readerId, readerId), eq(readerBillingLedger.entryType, "period_charge")))
    .orderBy(desc(readerBillingLedger.entryDate))
    .limit(1);

  if (!lastCharge) return subscriptionStartDate;
  const d = new Date(lastCharge.entryDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Sum of daily rates from the last posted period_charge date (or
// subscription start) through today — the missing piece that makes
// getAmountDue() correct across cycle boundaries without requiring a
// periodic Close Month click. Includes the current cycle's unbilled days
// just like the old getCurrentMonthProvisional did, but also every prior
// cycle that was never materialised into the ledger.
async function computeUnbilledCharge(
  readerId: number,
  context: { cityId: number; centerId: number; unitId: number; subscriptionStartDate: string }
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const periodStart = await getUnbilledPeriodStart(readerId, context.subscriptionStartDate);
  if (periodStart > today) return 0;

  const [pricingHistory, attendanceMap, overrides] = await Promise.all([
    getCityPricingHistory(context.cityId),
    getAttendanceMap(readerId, periodStart, today),
    getPriceOverridesFor(context.centerId, context.unitId),
  ]);

  return calculateCycleCharge({
    cycleStart: periodStart,
    cycleEnd: today,
    subscriptionStartDate: context.subscriptionStartDate,
    attendance: attendanceMap,
    pricingHistory,
    today,
    unmarkedDefault: unmarkedDefaultFor(),
    ...overrides,
  });
}

// Live, provisional total for the current (still open) billing period —
// recomputed on every read, never written to the ledger. Only used for
// SMS template rendering (the current-month {amount} tag); getAmountDue()
// is the canonical "what do they owe" number since it includes every
// unbilled cycle, not just the current one.
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
    unmarkedDefault: unmarkedDefaultFor(),
    ...overrides,
  });

  return { billingPeriod, cycleStart, cycleEnd, amount };
}

// The one number admin actually cares about: everything already posted to
// the ledger (readers.outstanding_balance) plus every unbilled day since the
// last posted period_charge (or subscription start if never billed) — so
// it's always accurate without needing a Close Month click, even when
// multiple billing cycles have passed without one. Negative means the reader
// is in credit (see reader-table.tsx / reader-profile-card.tsx for the
// "Credit" display treatment).
export async function getAmountDue(readerId: number): Promise<number> {
  const user = await requireAppUser();
  const context = await getReaderBillingContext(readerId);
  assertCenterInScope(user, context.centerId);

  const [row] = await db.select({ outstandingBalance: readers.outstandingBalance }).from(readers).where(eq(readers.id, readerId));
  if (!row) throw new Error("Reader not found.");

  const unbilled = await computeUnbilledCharge(readerId, context);
  return Math.round((Number(row.outstandingBalance) + unbilled) * 100) / 100;
}

// Shared by getCurrentMonthProvisional and closeSubscription: the currently
// open cycle for a reader, calendar-month by default or anchor-day-based if
// set. billingPeriod is the ledger's 'YYYY-MM' label — for anchor-day
// readers this is the cycle's start month, not necessarily today's month.
function currentCycleFor(anchorDay: number | null, referenceDate: string) {
  if (anchorDay == null) {
    const billingPeriod = referenceDate.slice(0, 7);
    // Real last day of the month — NOT a hardcoded "-31", which is an invalid
    // date string in any 30-day month (or February) and gets rejected by
    // Postgres when it flows into an attendance date-range query
    // (getAttendanceCountsForPeriod). Same idiom as periodDateRange below.
    const [y, m] = billingPeriod.split("-").map(Number);
    const cycleEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    return { cycleStart: `${billingPeriod}-01`, cycleEnd, billingPeriod };
  }
  const { cycleStart, cycleEnd } = getBillingCycle(anchorDay, referenceDate);
  return { cycleStart, cycleEnd, billingPeriod: cycleStart.slice(0, 7) };
}

export async function listLedgerForReader(readerId: number, dateFrom?: string, dateTo?: string) {
  const user = await requireAppUser();
  const context = await getReaderBillingContext(readerId);
  assertCenterInScope(user, context.centerId);

  const conditions = [eq(readerBillingLedger.readerId, readerId)];
  if (dateFrom) conditions.push(gte(readerBillingLedger.entryDate, dateFrom));
  if (dateTo) conditions.push(lte(readerBillingLedger.entryDate, dateTo));

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
    .where(and(...conditions))
    .orderBy(readerBillingLedger.createdAt);
}

export async function getBillingBreakdown(readerId: number) {
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

  const currentMonthUnbilled = calculateCycleCharge({
    cycleStart,
    cycleEnd,
    subscriptionStartDate: context.subscriptionStartDate,
    attendance: attendanceMap,
    pricingHistory,
    today,
    unmarkedDefault: unmarkedDefaultFor(),
    ...overrides,
  });

  const ledgerRows = await db
    .select({
      entryType: readerBillingLedger.entryType,
      amount: readerBillingLedger.amount,
      billingPeriod: readerBillingLedger.billingPeriod,
    })
    .from(readerBillingLedger)
    .where(eq(readerBillingLedger.readerId, readerId));

  const periodMap = new Map<string, number>();
  for (const row of ledgerRows) {
    const period = row.billingPeriod ?? "uncategorized";
    periodMap.set(period, (periodMap.get(period) ?? 0) + Number(row.amount));
  }

  const byPeriod: { billingPeriod: string; amount: number }[] = [];
  let previousOutstanding = 0;

  for (const [period, amount] of periodMap) {
    byPeriod.push({ billingPeriod: period === "uncategorized" ? "" : period, amount: Math.round(amount * 100) / 100 });
    if (period !== billingPeriod) {
      previousOutstanding += amount;
    }
  }

  byPeriod.sort((a, b) => b.billingPeriod.localeCompare(a.billingPeriod));

  const isClosedCurrentMonth = context.status === "inactive" &&
    ledgerRows.some((r) => r.billingPeriod === billingPeriod && r.entryType === "period_charge");

  return {
    previousOutstanding: Math.round(previousOutstanding * 100) / 100,
    currentMonthUnbilled: isClosedCurrentMonth ? 0 : currentMonthUnbilled,
    isClosedCurrentMonth,
    byPeriod,
  };
}

export type ReaderMonthlyLedgerRow = {
  billingPeriod: string;
  periodStart: string;
  periodEnd: string;
  isCurrentOpen: boolean;
  charges: number;
  paid: number;
  discounts: number;
  // net = charges - paid - discounts. due = underpaid (net positive),
  // credit = overpaid (net negative, shown as a positive amount).
  due: number;
  credit: number;
  delivered: number;
  notDelivered: number;
  notUpdated: number;
  notApplicable: number;
};

function periodDateRange(billingPeriod: string): { periodStart: string; periodEnd: string } {
  const [y, m] = billingPeriod.split("-").map(Number);
  const periodStart = `${billingPeriod}-01`;
  const periodEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { periodStart, periodEnd };
}

// 'YYYY-MM' -> the next calendar month's 'YYYY-MM'.
function monthAfter(billingPeriod: string): string {
  const [y, m] = billingPeriod.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // m (1-based) used as 0-based index == next month
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getAttendanceCountsForPeriod(
  readerId: number,
  periodStart: string,
  periodEnd: string,
  today: string
): Promise<{ delivered: number; notDelivered: number; notUpdated: number; notApplicable: number }> {
  const rows = await db
    .select({ status: attendance.status })
    .from(attendance)
    .where(
      and(eq(attendance.readerId, readerId), gte(attendance.attendanceDate, periodStart), lte(attendance.attendanceDate, periodEnd))
    );

  const delivered = rows.filter((a) => a.status === "delivered").length;
  const notDelivered = rows.filter((a) => a.status === "not_delivered").length;

  const periodStartDate = new Date(periodStart + "T00:00:00Z");
  const periodEndDate = new Date(periodEnd + "T00:00:00Z");
  const todayDate = new Date(today + "T00:00:00Z");
  const effectiveEnd = todayDate < periodEndDate ? todayDate : periodEndDate;

  let totalDaysSoFar = 0;
  const cursor = new Date(periodStartDate);
  while (cursor <= effectiveEnd) {
    totalDaysSoFar++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const notUpdated = Math.max(0, totalDaysSoFar - delivered - notDelivered);
  const totalDaysInPeriod = Math.round((periodEndDate.getTime() - periodStartDate.getTime()) / 86400000) + 1;
  const notApplicable = Math.max(0, totalDaysInPeriod - totalDaysSoFar);

  return { delivered, notDelivered, notUpdated, notApplicable };
}

// Per-period ledger summary for ONE reader — the money rows behind the
// Reader Ledger page. Includes every period that has ledger entries (closed
// periods) plus the currently open period with its live provisional charge,
// so "amount paid each month / overpaid / underpaid" is always answerable
// even before a Close Month has been run.
export async function getReaderMonthlyLedger(readerId: number): Promise<ReaderMonthlyLedgerRow[]> {
  const user = await requireAppUser();
  const context = await getReaderBillingContext(readerId);
  assertCenterInScope(user, context.centerId);

  const today = new Date().toISOString().slice(0, 10);

  const ledgerGrouped = await db
    .select({
      billingPeriod: readerBillingLedger.billingPeriod,
      charges: sql<number>`coalesce(sum(${readerBillingLedger.amount}) filter (where ${readerBillingLedger.entryType} = 'period_charge'), 0)`,
      payments: sql<number>`coalesce(sum(abs(${readerBillingLedger.amount})) filter (where ${readerBillingLedger.entryType} = 'payment'), 0)`,
      // Coupons always reduce the balance (stored negative) so abs() is fine;
      // adjustments are now SIGNED (a positive one is a fee that RAISES the
      // balance), so subtract their signed sum — negative adjustments add to
      // "discounts", positive ones offset it. Keeps net = charges - paid -
      // discounts correct in both directions, and unchanged for the
      // historical data where every adjustment was a write-off / reversal.
      discounts: sql<number>`
        coalesce(sum(abs(${readerBillingLedger.amount})) filter (where ${readerBillingLedger.entryType} = 'coupon_discount'), 0)
        - coalesce(sum(${readerBillingLedger.amount}) filter (where ${readerBillingLedger.entryType} = 'adjustment'), 0)`,
    })
    .from(readerBillingLedger)
    .where(eq(readerBillingLedger.readerId, readerId))
    .groupBy(readerBillingLedger.billingPeriod)
    .orderBy(desc(readerBillingLedger.billingPeriod));

  const { cycleStart, cycleEnd, billingPeriod: currentPeriod } = currentCycleFor(context.billingAnchorDay, today);
  // Some ledger entries (a payment, an adjustment) can carry a NULL
  // billing_period — they were never tied to a specific month. Keep them
  // out of the per-period loop (periodDateRange can't handle a null month)
  // and surface them as a single "Uncategorized" row so the money doesn't
  // silently vanish from the totals.
  const currentPeriodRows = ledgerGrouped.filter((r) => r.billingPeriod === currentPeriod);
  const closedPeriods = ledgerGrouped.filter((r) => r.billingPeriod !== currentPeriod && r.billingPeriod != null);
  const nullPeriodGroup = ledgerGrouped.filter((r) => r.billingPeriod == null);

  const isCurrentClosed = context.status === "inactive" && currentPeriodRows.length > 0;

  const rows: ReaderMonthlyLedgerRow[] = [];

  if (nullPeriodGroup.length > 0) {
    const charges = nullPeriodGroup.reduce((s, g) => s + Number(g.charges), 0);
    const paid = nullPeriodGroup.reduce((s, g) => s + Number(g.payments), 0);
    const discounts = nullPeriodGroup.reduce((s, g) => s + Number(g.discounts), 0);
    const net = charges - paid - discounts;
    rows.push({
      billingPeriod: "Uncategorized",
      periodStart: "",
      periodEnd: "",
      isCurrentOpen: false,
      charges: Math.round(charges * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      discounts: Math.round(discounts * 100) / 100,
      due: net > 0 ? Math.round(net * 100) / 100 : 0,
      credit: net < 0 ? Math.round(Math.abs(net) * 100) / 100 : 0,
      delivered: 0,
      notDelivered: 0,
      notUpdated: 0,
      notApplicable: 0,
    });
  }

  for (const group of closedPeriods) {
    const period = group.billingPeriod!;
    const { periodStart, periodEnd } = periodDateRange(period);
    const counts = await getAttendanceCountsForPeriod(readerId, periodStart, periodEnd, today);

    const charges = Number(group.charges);
    const paid = Number(group.payments);
    const discounts = Number(group.discounts);
    const net = charges - paid - discounts;

    rows.push({
      billingPeriod: period,
      periodStart,
      periodEnd,
      isCurrentOpen: false,
      charges: Math.round(charges * 100) / 100,
      paid: Math.round(paid * 100) / 100,
      discounts: Math.round(discounts * 100) / 100,
      due: net > 0 ? Math.round(net * 100) / 100 : 0,
      credit: net < 0 ? Math.round(Math.abs(net) * 100) / 100 : 0,
      ...counts,
    });
  }

  // Elapsed calendar months between subscription start and the current cycle
  // that have NO ledger row at all — e.g. a month that was still the open
  // cycle when the historical backfill last ran (so it was skipped) and has
  // had no Close Subscription since. Without this the Monthly Ledger simply
  // omits that month. Charge is computed live the same way the current cycle
  // is; if a period_charge is posted for it later it moves into closedPeriods
  // above with an identical figure. A month with no period_charge can't carry
  // payments/discounts either (those would put it in ledgerGrouped), so
  // paid/discounts are 0 here by construction.
  const representedPeriods = new Set<string>([currentPeriod, ...closedPeriods.map((g) => g.billingPeriod!)]);
  const missingPeriods: string[] = [];
  for (
    let p = context.subscriptionStartDate.slice(0, 7);
    p < currentPeriod;
    p = monthAfter(p)
  ) {
    if (!representedPeriods.has(p)) missingPeriods.push(p);
  }

  if (missingPeriods.length > 0) {
    const [pricingHistory, overrides] = await Promise.all([
      getCityPricingHistory(context.cityId),
      getPriceOverridesFor(context.centerId, context.unitId),
    ]);
    for (const period of missingPeriods) {
      const { periodStart, periodEnd } = periodDateRange(period);
      const [attendanceMap, counts] = await Promise.all([
        getAttendanceMap(readerId, periodStart, periodEnd),
        getAttendanceCountsForPeriod(readerId, periodStart, periodEnd, today),
      ]);
      const charges = calculateCycleCharge({
        cycleStart: periodStart,
        cycleEnd: periodEnd,
        subscriptionStartDate: context.subscriptionStartDate,
        attendance: attendanceMap,
        pricingHistory,
        today: periodEnd, // fully elapsed month — bill the whole range
        unmarkedDefault: unmarkedDefaultFor(),
        ...overrides,
      });
      rows.push({
        billingPeriod: period,
        periodStart,
        periodEnd,
        isCurrentOpen: false,
        charges: Math.round(charges * 100) / 100,
        paid: 0,
        discounts: 0,
        due: charges > 0 ? Math.round(charges * 100) / 100 : 0,
        credit: 0,
        ...counts,
      });
    }
  }

  // Current (open) period — provisional charge unless the subscription is
  // closed for it, attendance counted live through today.
  const periodStart = cycleStart;
  const periodEnd = cycleEnd;
  const counts = await getAttendanceCountsForPeriod(readerId, periodStart, periodEnd, today);

  let charges = currentPeriodRows.length > 0 ? Number(currentPeriodRows[0].charges) : 0;
  if (!isCurrentClosed) {
    const [pricingHistory, attendanceMap, overrides] = await Promise.all([
      getCityPricingHistory(context.cityId),
      getAttendanceMap(readerId, periodStart, today),
      getPriceOverridesFor(context.centerId, context.unitId),
    ]);
    charges = calculateCycleCharge({
      cycleStart,
      cycleEnd,
      subscriptionStartDate: context.subscriptionStartDate,
      attendance: attendanceMap,
      pricingHistory,
      today,
      unmarkedDefault: unmarkedDefaultFor(),
      ...overrides,
    });
  }

  const paid = currentPeriodRows.length > 0 ? Number(currentPeriodRows[0].payments) : 0;
  const discounts = currentPeriodRows.length > 0 ? Number(currentPeriodRows[0].discounts) : 0;
  const net = charges - paid - discounts;

  rows.push({
    billingPeriod: currentPeriod,
    periodStart,
    periodEnd,
    isCurrentOpen: !isCurrentClosed,
    charges: Math.round(charges * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    discounts: Math.round(discounts * 100) / 100,
    due: net > 0 ? Math.round(net * 100) / 100 : 0,
    credit: net < 0 ? Math.round(Math.abs(net) * 100) / 100 : 0,
    ...counts,
  });

  // Current open period first, then closed periods newest-first, and the
  // period-less "Uncategorized" bucket at the very bottom.
  return rows.sort((a, b) => {
    if (a.isCurrentOpen !== b.isCurrentOpen) return a.isCurrentOpen ? -1 : 1;
    if (a.billingPeriod === "Uncategorized") return 1;
    if (b.billingPeriod === "Uncategorized") return -1;
    return b.billingPeriod.localeCompare(a.billingPeriod);
  });
}

export interface CloseSubscriptionOptions {
  /**
   * Admin-only custom ledger adjustment posted alongside the final charge —
   * `amount` is a SIGNED delta on outstanding_balance (negative to waive what's
   * pending, positive to add a fee — see lib/billing/adjustment.ts); `reason`
   * becomes the ledger entry's description (e.g. "Closing Adjustment"). To
   * write off the whole pending balance, pass amount = -(amount due).
   */
  adjustment?: { amount: number; reason: string };
}

export interface CloseSubscriptionResult {
  billingPeriod: string;
  amount: number;
  adjustmentAmount?: number;
}

// Replaces the old periodic Close Month / closeReaderCycle ritual — billing
// no longer requires a recurring admin click (see getAmountDue() below for
// the live running total shown everywhere instead). This is only for when a
// reader's subscription actually ends: it posts ONE final ledger charge for
// everything accrued since their last posted period_charge (or subscription
// start if they were never billed), then marks them inactive. Idempotent in
// the sense that closing an already-inactive reader is rejected outright
// rather than double-charging them.
export async function closeSubscription(readerId: number, options?: CloseSubscriptionOptions): Promise<CloseSubscriptionResult> {
  const user = await requireAppUser();
  const context = await getReaderBillingContext(readerId);
  if (context.status === "inactive") {
    throw new Error("This reader's subscription is already closed.");
  }

  const adjustment = options?.adjustment;
  if (adjustment && adjustment.amount !== 0) {
    if (user.role !== "admin") throw new Error("Only Administrators can post a manual adjustment.");
    if (!adjustment.reason?.trim()) throw new Error("A closing adjustment needs a reason.");
  }

  const today = new Date().toISOString().slice(0, 10);

  let periodStart = await getUnbilledPeriodStart(readerId, context.subscriptionStartDate);
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
    unmarkedDefault: unmarkedDefaultFor(),
    ...overrides,
  });

  const postAdjustment = adjustment != null && adjustment.amount !== 0;

  await db.transaction(async (tx) => {
    // Always post the final period_charge (a $0 row when nothing accrued, for
    // the audit trail). A closing write-off is now an explicit adjustment
    // entered by the admin, not an automatic replacement of this charge.
    await postLedgerEntry(
      {
        readerId,
        entryType: "period_charge",
        amount: amount > 0 ? amount : 0,
        billingPeriod,
        entryDate: today,
        description:
          amount > 0
            ? `Subscription closed ${periodStart} – ${today}`
            : `Subscription closed ${periodStart} – ${today} (no outstanding)`,
        createdBy: user.id,
      },
      tx
    );

    if (postAdjustment) {
      await postLedgerEntry(
        {
          readerId,
          entryType: "adjustment",
          amount: adjustment!.amount,
          billingPeriod,
          entryDate: today,
          description: adjustment!.reason.trim(),
          createdBy: user.id,
        },
        tx
      );
    }

    await tx.update(readers).set({ status: "inactive" }).where(eq(readers.id, readerId));
  });

  return { billingPeriod, amount, adjustmentAmount: postAdjustment ? adjustment!.amount : undefined };
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

  // Fetch last period_charge date for every reader to determine each
  // reader's unbilled period start — the minimum across all readers sets
  // the attendance window so past cycles are included, not just the
  // current one.
  const readerIds = rows.map((r) => r.id);
  const lastChargeRows = await db
    .select({
      readerId: readerBillingLedger.readerId,
      entryDate: max(readerBillingLedger.entryDate),
    })
    .from(readerBillingLedger)
    .where(and(inArray(readerBillingLedger.readerId, readerIds), eq(readerBillingLedger.entryType, "period_charge")))
    .groupBy(readerBillingLedger.readerId);
  const lastChargeByReader = new Map(lastChargeRows.map((r) => [r.readerId, r.entryDate]));

  let globalWindowStart = today;
  for (const r of rows) {
    const lastCharge = lastChargeByReader.get(r.id);
    const periodStart = lastCharge
      ? new Date(new Date(lastCharge + "T00:00:00Z").getTime() + 86400000).toISOString().slice(0, 10)
      : r.subscriptionStartDate;
    if (periodStart < globalWindowStart) globalWindowStart = periodStart;
  }

  const attendanceRows = await db
    .select({ readerId: attendance.readerId, attendanceDate: attendance.attendanceDate, status: attendance.status })
    .from(attendance)
    .where(and(inArray(attendance.readerId, readerIds), gte(attendance.attendanceDate, globalWindowStart), lte(attendance.attendanceDate, today)));
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
    const lastCharge = lastChargeByReader.get(r.id);
    const periodStart = lastCharge
      ? new Date(new Date(lastCharge + "T00:00:00Z").getTime() + 86400000).toISOString().slice(0, 10)
      : r.subscriptionStartDate;
    const overrides = resolveOverridesForContext(overrideRows, r.centerId, r.unitId);
    const unbilled = calculateCycleCharge({
      cycleStart: periodStart,
      cycleEnd: today,
      subscriptionStartDate: r.subscriptionStartDate,
      attendance: attendanceByReader.get(r.id) ?? {},
      pricingHistory: pricingByCityId.get(r.cityId) ?? [],
      today,
      unmarkedDefault: unmarkedDefaultFor(),
      ...overrides,
    });
    const amountDue = Math.round((Number(r.outstandingBalance) + unbilled) * 100) / 100;
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
