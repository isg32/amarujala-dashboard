import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { eq, inArray, sql } from "drizzle-orm";
import {
  readers,
  attendance,
  payments,
  coupons,
  readerCoupons,
  readerBillingLedger,
  centers,
  cityPricing,
} from "@/lib/db/schema";
import { calculateMonthCharge, type AttendanceStatus } from "@/lib/billing/calculate";

neonConfig.webSocketConstructor = ws;
const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), {
  schema: {},
});

// Mirrors lib/billing/ledger.ts: postLedgerEntry() — reimplemented locally
// because that module imports "server-only", which throws outside Next's
// server runtime (this is a standalone script, same as scripts/seed.ts).
async function postLedgerEntry(input: {
  readerId: number;
  entryType: "monthly_charge" | "payment" | "coupon_discount" | "adjustment";
  amount: number;
  billingPeriod?: string;
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

const ADMIN_ID = "306c8cf6-ad7a-47a6-8e97-e0a3b4c2575b";
const TODAY = "2026-07-07";

const NAMES = [
  "Rajesh Kumar", "Sunita Sharma", "Amit Verma", "Priya Singh", "Vikram Rathore",
  "Anita Gupta", "Sanjay Yadav", "Kavita Joshi", "Manoj Tiwari", "Deepa Chauhan",
  "Ravi Shankar", "Neha Agarwal", "Suresh Pillai", "Pooja Mehta", "Arun Nair",
  "Rekha Bhatt", "Ashok Malhotra", "Geeta Kapoor",
];

function mobile(i: number) {
  return `98765${String(10000 + i).slice(-5)}`;
}

function pad(n: number) {
  return `RDR-${String(n).padStart(6, "0")}`;
}

async function main() {
  // Clean up leftover Playwright test data from a prior verification round.
  const stale = await db.select({ id: readers.id }).from(readers).where(eq(readers.name, "Reversal Test Reader"));
  if (stale.length > 0) {
    const staleIds = stale.map((r) => r.id);
    await db.delete(readerBillingLedger).where(inArray(readerBillingLedger.readerId, staleIds));
    await db.delete(payments).where(inArray(payments.readerId, staleIds));
    await db.delete(attendance).where(inArray(attendance.readerId, staleIds));
    await db.delete(readers).where(inArray(readers.id, staleIds));
    console.log(`Removed ${staleIds.length} stale test reader(s).`);
  }

  const existing = await db.select({ id: readers.id }).from(readers);
  if (existing.length > 0) {
    console.log(`${existing.length} reader(s) already present, skipping mock data seed.`);
    return;
  }

  const allCenters = await db.select().from(centers);
  const pricingRows = await db.select().from(cityPricing);
  const pricingByCity = new Map<number, { price: number; effectiveFrom: string }[]>();
  for (const p of pricingRows) {
    const list = pricingByCity.get(p.cityId) ?? [];
    list.push({ price: Number(p.price), effectiveFrom: p.effectiveFrom });
    pricingByCity.set(p.cityId, list);
  }

  const subscriptionStarts = [
    "2026-01-15", "2026-02-01", "2026-03-10", "2026-01-01", "2026-04-05",
    "2026-02-20", "2026-01-01", "2026-05-12", "2026-03-01", "2026-01-01",
    "2026-06-01", "2026-06-20", "2026-02-14", "2026-01-01", "2026-04-18",
    "2026-03-25", "2026-01-01", "2026-07-01",
  ];

  const createdReaders: { id: number; centerId: number; cityId: number; subscriptionStartDate: string }[] = [];

  for (let i = 0; i < NAMES.length; i++) {
    const center = allCenters[i % allCenters.length];
    const [row] = await db
      .insert(readers)
      .values({
        readerCode: pad(i + 1),
        name: NAMES[i],
        mobile: mobile(i),
        email: null,
        address: `House ${100 + i}, ${center.name}`,
        landmark: null,
        centerId: center.id,
        subscriptionStartDate: subscriptionStarts[i],
        status: i === NAMES.length - 1 ? "inactive" : "active",
        createdBy: ADMIN_ID,
      })
      .returning();
    createdReaders.push({
      id: row.id,
      centerId: center.id,
      cityId: center.cityId,
      subscriptionStartDate: subscriptionStarts[i],
    });
  }
  console.log(`Created ${createdReaders.length} readers.`);

  // Attendance: June (fully closed month) + July 1-6 (in-progress). Mostly
  // delivered, a few not_delivered, and some days deliberately left unmarked
  // to exercise the default-to-delivered rule.
  const attendanceRows: (typeof attendance.$inferInsert)[] = [];
  for (const [idx, reader] of createdReaders.entries()) {
    for (const [year, month, lastDay] of [[2026, 6, 30] as const, [2026, 7, 6] as const]) {
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      if (reader.subscriptionStartDate > `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`) {
        continue; // subscription hasn't started yet this month
      }
      const start = reader.subscriptionStartDate > monthStart ? reader.subscriptionStartDate : monthStart;
      const startDay = Number(start.slice(8, 10));
      for (let day = startDay; day <= lastDay; day++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const roll = (idx * 31 + day) % 10;
        if (roll === 0) continue; // ~10% left unmarked
        const status: AttendanceStatus = roll === 1 && idx % 3 === 0 ? "not_delivered" : "delivered";
        attendanceRows.push({
          readerId: reader.id,
          attendanceDate: dateStr,
          status,
          markedBy: ADMIN_ID,
        });
      }
    }
  }
  await db.insert(attendance).values(attendanceRows);
  console.log(`Created ${attendanceRows.length} attendance rows.`);

  // Close June for every reader whose subscription had started by then.
  const attendanceByReader = new Map<number, Record<string, AttendanceStatus>>();
  for (const row of attendanceRows) {
    if (!row.attendanceDate.startsWith("2026-06")) continue;
    const map = attendanceByReader.get(row.readerId) ?? {};
    map[row.attendanceDate] = row.status;
    attendanceByReader.set(row.readerId, map);
  }

  let closedCount = 0;
  for (const reader of createdReaders) {
    if (reader.subscriptionStartDate > "2026-06-30") continue;
    const pricingHistory = pricingByCity.get(reader.cityId) ?? [];
    const charge = calculateMonthCharge({
      billingPeriod: "2026-06",
      subscriptionStartDate: reader.subscriptionStartDate,
      attendance: attendanceByReader.get(reader.id) ?? {},
      pricingHistory,
      today: "2026-06-30",
    });
    if (charge <= 0) continue;
    await postLedgerEntry({
      readerId: reader.id,
      entryType: "monthly_charge",
      amount: charge,
      billingPeriod: "2026-06",
      description: "June 2026 delivery charge",
      createdBy: ADMIN_ID,
    });
    closedCount++;
  }
  console.log(`Closed June 2026 billing for ${closedCount} readers.`);

  // Payments: roughly 2 in 3 readers pay something toward their June charge.
  let paymentCount = 0;
  for (const [idx, reader] of createdReaders.entries()) {
    if (idx % 3 === 2) continue;
    const [bal] = await db.select({ b: readers.outstandingBalance }).from(readers).where(eq(readers.id, reader.id));
    const owed = Number(bal?.b ?? 0);
    if (owed <= 0) continue;
    const payFull = idx % 3 === 0;
    const amount = payFull ? owed : Math.round((owed / 2) * 100) / 100;
    const [payment] = await db
      .insert(payments)
      .values({
        readerId: reader.id,
        amount: amount.toFixed(2),
        method: idx % 2 === 0 ? "cash" : "upi",
        paymentDate: "2026-06-28",
        recordedBy: ADMIN_ID,
      })
      .returning();
    await postLedgerEntry({
      readerId: reader.id,
      entryType: "payment",
      amount: -amount,
      referenceId: payment.id,
      description: `Payment via ${payment.method}`,
      createdBy: ADMIN_ID,
    });
    paymentCount++;
  }
  console.log(`Recorded ${paymentCount} payments.`);

  // Coupons.
  const [welcome, festive] = await db
    .insert(coupons)
    .values([
      { code: "WELCOME50", description: "New reader welcome discount", discountAmount: "50.00", createdBy: ADMIN_ID },
      { code: "FESTIVE100", description: "Festive season discount", discountAmount: "100.00", createdBy: ADMIN_ID },
    ])
    .returning();

  const couponTarget = createdReaders[0];
  await db.insert(readerCoupons).values({
    couponId: welcome.id,
    readerId: couponTarget.id,
    appliedAmount: welcome.discountAmount,
    appliedBy: ADMIN_ID,
    remarks: "Applied at signup",
  });
  await postLedgerEntry({
    readerId: couponTarget.id,
    entryType: "coupon_discount",
    amount: -Number(welcome.discountAmount),
    referenceId: welcome.id,
    description: `Coupon ${welcome.code} applied`,
    createdBy: ADMIN_ID,
  });
  console.log(`Created 2 coupons, applied 1 to reader ${couponTarget.id}.`);

  console.log("Mock data seed complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
