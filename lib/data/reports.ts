import "server-only";
import { and, count, eq, gte, inArray, lt, sql as sqlOp } from "drizzle-orm";
import { requireAppUser, type AppUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { readers, centers, cities, appUsers, attendance, payments, readerBillingLedger } from "@/lib/db/schema";

function scopeCondition(user: AppUser) {
  if (user.role === "admin") return undefined;
  if (user.centerIds.length === 0) return sqlOp`false`;
  return inArray(readers.centerId, user.centerIds);
}

export async function getDashboardKpis() {
  const user = await requireAppUser();
  const scope = scopeCondition(user);
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const now = new Date();
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalRow] = await db.select({ n: count() }).from(readers).where(scope);
  const [activeRow] = await db.select({ n: count() }).from(readers).where(and(scope, eq(readers.status, "active")));
  const [inactiveRow] = await db.select({ n: count() }).from(readers).where(and(scope, eq(readers.status, "inactive")));
  const [newRow] = await db.select({ n: count() }).from(readers).where(and(scope, gte(readers.createdAt, thirtyDaysAgo)));

  const byCity = await db
    .select({ label: cities.name, n: count() })
    .from(readers)
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .where(scope)
    .groupBy(cities.name);

  const byCenter = await db
    .select({ label: centers.name, n: count() })
    .from(readers)
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .where(scope)
    .groupBy(centers.name);

  const [totalCollections] = await db
    .select({ total: sqlOp<string>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(readers, eq(payments.readerId, readers.id))
    .where(scope);
  const [outstandingDues] = await db
    .select({ total: sqlOp<string>`coalesce(sum(${readers.outstandingBalance}), 0)` })
    .from(readers)
    .where(and(scope, sqlOp`${readers.outstandingBalance} > 0`));
  const [paymentsToday] = await db
    .select({ total: sqlOp<string>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(readers, eq(payments.readerId, readers.id))
    .where(and(scope, eq(payments.paymentDate, today)));
  const [paymentsThisMonth] = await db
    .select({ total: sqlOp<string>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .innerJoin(readers, eq(payments.readerId, readers.id))
    .where(and(scope, gte(payments.paymentDate, monthStart), lt(payments.paymentDate, nextMonthStart)));

  const [deliveredToday] = await db
    .select({ n: count() })
    .from(attendance)
    .innerJoin(readers, eq(attendance.readerId, readers.id))
    .where(and(scope, eq(attendance.attendanceDate, today), eq(attendance.status, "delivered")));
  const [absentToday] = await db
    .select({ n: count() })
    .from(attendance)
    .innerJoin(readers, eq(attendance.readerId, readers.id))
    .where(and(scope, eq(attendance.attendanceDate, today), eq(attendance.status, "not_delivered")));
  const [monthDelivered] = await db
    .select({ n: count() })
    .from(attendance)
    .innerJoin(readers, eq(attendance.readerId, readers.id))
    .where(
      and(
        scope,
        gte(attendance.attendanceDate, monthStart),
        lt(attendance.attendanceDate, nextMonthStart),
        eq(attendance.status, "delivered")
      )
    );
  const [monthTotal] = await db
    .select({ n: count() })
    .from(attendance)
    .innerJoin(readers, eq(attendance.readerId, readers.id))
    .where(and(scope, gte(attendance.attendanceDate, monthStart), lt(attendance.attendanceDate, nextMonthStart)));

  return {
    readers: {
      total: totalRow.n,
      active: activeRow.n,
      inactive: inactiveRow.n,
      newLast30Days: newRow.n,
      byCity,
      byCenter,
    },
    payments: {
      totalCollections: Number(totalCollections.total),
      outstandingDues: Number(outstandingDues.total),
      today: Number(paymentsToday.total),
      thisMonth: Number(paymentsThisMonth.total),
    },
    delivery: {
      deliveredToday: deliveredToday.n,
      absentToday: absentToday.n,
      monthlyDeliveryPercent: monthTotal.n > 0 ? Math.round((monthDelivered.n / monthTotal.n) * 100) : 0,
    },
  };
}

export type ReportCenterFilter = { centerId?: number };

export async function getPaymentDueReport(filters: ReportCenterFilter = {}) {
  const user = await requireAppUser();
  const scope = scopeCondition(user);

  return db
    .select({
      id: readers.id,
      readerCode: readers.readerCode,
      name: readers.name,
      mobile: readers.mobile,
      centerName: centers.name,
      cityName: cities.name,
      outstandingBalance: readers.outstandingBalance,
    })
    .from(readers)
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .where(
      and(
        scope,
        sqlOp`${readers.outstandingBalance} > 0`,
        filters.centerId ? eq(readers.centerId, filters.centerId) : undefined
      )
    )
    .orderBy(sqlOp`${readers.outstandingBalance} desc`);
}

export async function getAttendanceReport(dateFrom: string, dateTo: string, filters: ReportCenterFilter = {}) {
  const user = await requireAppUser();
  const scope = scopeCondition(user);

  return db
    .select({
      id: readers.id,
      readerCode: readers.readerCode,
      name: readers.name,
      centerName: centers.name,
      delivered: sqlOp<number>`count(*) filter (where ${attendance.status} = 'delivered')`,
      absent: sqlOp<number>`count(*) filter (where ${attendance.status} = 'not_delivered')`,
    })
    .from(attendance)
    .innerJoin(readers, eq(attendance.readerId, readers.id))
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .where(
      and(
        scope,
        gte(attendance.attendanceDate, dateFrom),
        sqlOp`${attendance.attendanceDate} <= ${dateTo}`,
        filters.centerId ? eq(readers.centerId, filters.centerId) : undefined
      )
    )
    .groupBy(readers.id, readers.readerCode, readers.name, centers.name)
    .orderBy(readers.name);
}

type GroupBy = "city" | "center" | "poc";
export type GroupedReportFilters = ReportCenterFilter & { dateFrom?: string; dateTo?: string };

// Three separate grouped queries merged by label, rather than one query
// joining readers/payments/attendance together — joining fan-out tables like
// that would inflate the outstanding-balance sum and delivery counts.
export async function getGroupedReport(groupBy: GroupBy, filters: GroupedReportFilters = {}) {
  const user = await requireAppUser();
  const scope = scopeCondition(user);
  const label = groupBy === "city" ? cities.name : groupBy === "center" ? centers.name : appUsers.name;
  const centerFilter = filters.centerId ? eq(readers.centerId, filters.centerId) : undefined;

  const readerStatsQuery = db
    .select({
      label,
      readerCount: count(readers.id),
      outstandingDues: sqlOp<string>`coalesce(sum(${readers.outstandingBalance}), 0)`,
    })
    .from(readers)
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .leftJoin(appUsers, eq(readers.assignedPocId, appUsers.id))
    .where(and(scope, centerFilter))
    .groupBy(label);

  const collectionsQuery = db
    .select({
      label,
      totalCollections: sqlOp<string>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .innerJoin(readers, eq(payments.readerId, readers.id))
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .leftJoin(appUsers, eq(readers.assignedPocId, appUsers.id))
    .where(and(scope, centerFilter))
    .groupBy(label);

  const attendanceQuery = db
    .select({
      label,
      delivered: sqlOp<number>`count(*) filter (where ${attendance.status} = 'delivered')`,
      undelivered: sqlOp<number>`count(*) filter (where ${attendance.status} = 'not_delivered')`,
    })
    .from(attendance)
    .innerJoin(readers, eq(attendance.readerId, readers.id))
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .leftJoin(appUsers, eq(readers.assignedPocId, appUsers.id))
    .where(
      and(
        scope,
        centerFilter,
        filters.dateFrom ? gte(attendance.attendanceDate, filters.dateFrom) : undefined,
        filters.dateTo ? sqlOp`${attendance.attendanceDate} <= ${filters.dateTo}` : undefined
      )
    )
    .groupBy(label);

  const [readerStats, collections, attendanceStats] = await Promise.all([
    readerStatsQuery,
    collectionsQuery,
    attendanceQuery,
  ]);
  const collectionsByLabel = new Map(collections.map((c) => [c.label, c.totalCollections]));
  const attendanceByLabel = new Map(attendanceStats.map((a) => [a.label, a]));

  return readerStats.map((r) => ({
    label: r.label ?? "(unassigned)",
    readerCount: r.readerCount,
    outstandingDues: Number(r.outstandingDues),
    totalCollections: Number(collectionsByLabel.get(r.label) ?? 0),
    delivered: attendanceByLabel.get(r.label)?.delivered ?? 0,
    undelivered: attendanceByLabel.get(r.label)?.undelivered ?? 0,
  }));
}

// Ledger totals grouped by the calendar month each entry was posted in
// (created_at, not billing_period — payments/discounts aren't tagged with a
// billing_period, only monthly_charge entries are, so grouping by when the
// activity actually happened is what makes this a true monthly summary).
export async function getMonthlySummaryReport(filters: ReportCenterFilter = {}) {
  const user = await requireAppUser();
  const scope = scopeCondition(user);

  const rows = await db
    .select({
      month: sqlOp<string>`to_char(${readerBillingLedger.createdAt}, 'YYYY-MM')`,
      entryType: readerBillingLedger.entryType,
      total: sqlOp<string>`sum(${readerBillingLedger.amount})`,
    })
    .from(readerBillingLedger)
    .innerJoin(readers, eq(readerBillingLedger.readerId, readers.id))
    .where(and(scope, filters.centerId ? eq(readers.centerId, filters.centerId) : undefined))
    .groupBy(sqlOp`to_char(${readerBillingLedger.createdAt}, 'YYYY-MM')`, readerBillingLedger.entryType);

  const byMonth = new Map<string, { charges: number; payments: number; discounts: number }>();
  for (const row of rows) {
    if (!byMonth.has(row.month)) byMonth.set(row.month, { charges: 0, payments: 0, discounts: 0 });
    const bucket = byMonth.get(row.month)!;
    const amount = Number(row.total);
    if (row.entryType === "monthly_charge") bucket.charges += amount;
    else if (row.entryType === "payment") bucket.payments += -amount; // stored negative; show as a positive collected total
    else if (row.entryType === "coupon_discount") bucket.discounts += -amount;
  }

  return [...byMonth.entries()]
    .map(([month, totals]) => ({ month, ...totals }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
}
