import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql, eq, and, gte, lte, desc } from "drizzle-orm";
import { readers, readerBillingLedger, centers, cities, attendance, cityPricing, pricingOverrides } from "@/lib/db/schema";
import { calculateCycleCharge, getBillingCycle } from "@/lib/billing/calculate";

const db = drizzle({ client: new Pool({ connectionString: process.env.DATABASE_URL }) });

// Default unmarked = not_delivered (never billed)
function unmarkedDefault(): "not_delivered" { return "not_delivered"; }

async function postLedgerEntryDirect(input: {
  readerId: number;
  entryType: "period_charge" | "payment" | "coupon_discount" | "adjustment";
  amount: number;
  billingPeriod?: string;
  entryDate?: string;
  referenceId?: number;
  description?: string;
  createdBy?: string;
}) {
  await db.transaction(async (tx) => {
    await tx.insert(readerBillingLedger).values({
      readerId: input.readerId,
      entryType: input.entryType,
      amount: input.amount.toFixed(2),
      billingPeriod: input.billingPeriod,
      entryDate: input.entryDate,
      referenceId: input.referenceId,
      description: input.description,
      createdBy: input.createdBy,
    });

    await tx
      .update(readers)
      .set({ outstandingBalance: sql`${readers.outstandingBalance} + ${input.amount}` })
      .where(eq(readers.id, input.readerId));
  });
}

async function getCityPricingHistory(cityId: number) {
  const rows = await db.select({ price: cityPricing.price, effectiveFrom: cityPricing.effectiveFrom })
    .from(cityPricing).where(eq(cityPricing.cityId, cityId));
  return rows.map(r => ({ price: Number(r.price), effectiveFrom: r.effectiveFrom }));
}

async function getPriceOverrides(centerId: number, unitId: number) {
  const rows = await db.select().from(pricingOverrides).where(eq(pricingOverrides.active, true));
  const ongoing = rows.filter(r => r.forDate == null);
  const dated = rows.filter(r => r.forDate != null);
  const find = (list: typeof rows, scope: string, scopeId: number | null) => 
    list.find(r => r.scope === scope && r.scopeId === scopeId);
  const centerOverride = find(ongoing, "center", centerId)?.dailyPrice;
  const unitOverride = find(ongoing, "unit", unitId)?.dailyPrice;
  const globalDefault = find(ongoing, "global", null)?.dailyPrice;
  const specialDayPrices: Record<string, number> = {};
  for (const forDate of new Set(dated.map(r => r.forDate!))) {
    const dayRows = dated.filter(r => r.forDate === forDate);
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

async function getAttendanceMap(readerId: number, periodStart: string, periodEnd: string) {
  const rows = await db.select({ attendanceDate: attendance.attendanceDate, status: attendance.status })
    .from(attendance)
    .where(and(eq(attendance.readerId, readerId), gte(attendance.attendanceDate, periodStart), lte(attendance.attendanceDate, periodEnd)));
  return Object.fromEntries(rows.map(r => [r.attendanceDate, r.status]));
}

async function backfillReader(readerId: number, adminId: string) {
  const [reader] = await db.select({
    id: readers.id,
    centerId: readers.centerId,
    cityId: centers.cityId,
    unitId: cities.unitId,
    subscriptionStartDate: readers.subscriptionStartDate,
    billingAnchorDay: readers.billingAnchorDay,
  }).from(readers)
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .where(eq(readers.id, readerId));
  
  if (!reader) return { posted: 0, skipped: 0 };

  // Find last posted period_charge
  const [lastCharge] = await db.select({ billingPeriod: readerBillingLedger.billingPeriod })
    .from(readerBillingLedger)
    .where(and(eq(readerBillingLedger.readerId, readerId), eq(readerBillingLedger.entryType, "period_charge")))
    .orderBy(desc(readerBillingLedger.billingPeriod))
    .limit(1);

  const today = new Date().toISOString().slice(0, 10);
  const currentPeriod = today.slice(0, 7);

  // Determine start period
  let startPeriod: string;
  if (lastCharge?.billingPeriod) {
    // Next month after last charge
    const [y, m] = lastCharge.billingPeriod.split("-").map(Number);
    const next = new Date(Date.UTC(y, m, 1));
    startPeriod = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  } else {
    // From subscription start
    startPeriod = reader.subscriptionStartDate.slice(0, 7);
  }

  if (startPeriod >= currentPeriod) {
    return { posted: 0, skipped: 0 }; // No historical periods to backfill
  }

  const [pricingHistory, overrides] = await Promise.all([
    getCityPricingHistory(reader.cityId),
    getPriceOverrides(reader.centerId, reader.unitId),
  ]);

  let posted = 0;
  let period = startPeriod;

  while (period < currentPeriod) {
    // Check if already has period_charge for this period
    const [existing] = await db.select({ id: readerBillingLedger.id })
      .from(readerBillingLedger)
      .where(and(eq(readerBillingLedger.readerId, readerId), eq(readerBillingLedger.entryType, "period_charge"), eq(readerBillingLedger.billingPeriod, period)))
      .limit(1);
    
    if (existing) {
      period = nextPeriod(period);
      continue;
    }

    // Calculate period dates
    let cycleStart: string, cycleEnd: string;
    if (reader.billingAnchorDay) {
      const cycle = getBillingCycle(reader.billingAnchorDay, `${period}-15`);
      cycleStart = cycle.cycleStart;
      cycleEnd = cycle.cycleEnd;
    } else {
      // Calendar month - need proper end date
      const [y, m] = period.split("-").map(Number);
      cycleStart = `${period}-01`;
      // Last day of month
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
      cycleEnd = `${period}-${String(lastDay).padStart(2, "0")}`;
    }

    // Get attendance for this period
    const attendanceMap = await getAttendanceMap(readerId, cycleStart, cycleEnd);

    // Calculate charge
    const charge = calculateCycleCharge({
      cycleStart, cycleEnd,
      subscriptionStartDate: reader.subscriptionStartDate,
      attendance: attendanceMap,
      pricingHistory,
      today: cycleEnd, // Full period
      unmarkedDefault: unmarkedDefault(),
      ...overrides,
    });

    if (charge > 0) {
      await postLedgerEntryDirect({
        readerId,
        entryType: "period_charge",
        amount: charge,
        billingPeriod: period,
        entryDate: cycleEnd,
        description: `Backfilled period charge for ${period}`,
        createdBy: adminId,
      });
      posted++;
    }

    period = nextPeriod(period);
  }

  return { posted, skipped: 0 };
}

function nextPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function main() {
  const adminId = "306c8cf6-ad7a-47a6-8e97-e0a3b4c2575b"; // ADMIN_ID from seed
  
  const allReaders = await db.select({ id: readers.id }).from(readers).where(eq(readers.status, "active"));
  console.log(`Backfilling ${allReaders.length} active readers...`);
  
  let totalPosted = 0;
  for (const r of allReaders) {
    const result = await backfillReader(r.id, adminId);
    if (result.posted > 0) {
      console.log(`Reader ${r.id}: posted ${result.posted} historical periods`);
      totalPosted += result.posted;
    }
  }
  
  console.log(`Done. Total period_charge entries posted: ${totalPosted}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });