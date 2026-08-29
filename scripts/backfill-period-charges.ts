import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";
import {
  calculateCycleCharge,
  getBillingCycle,
  type PricePeriod,
} from "@/lib/billing/calculate";

// Backfills missing historical `period_charge` ledger rows so each past
// billing month shows up in the Reader Ledger's Monthly table (and its CSV),
// instead of only the current live cycle.
//
// Rule (matches live billing, lib/data/billing.ts): an unmarked attendance day
// is NEVER billed — unmarkedDefault = "not_delivered". A month with no marked
// deliveries therefore backfills to 0 and posts nothing.
//
// Batch design: everything is loaded in a handful of set-based queries and the
// per-reader/per-month charge is computed in memory, then written in one
// transaction. (The earlier row-at-a-time version issued ~5 round-trips per
// reader and never finished against the remote DB.)
//
// Idempotent: skips any (reader, period) that already has a period_charge, and
// recomputes outstanding_balance straight from the ledger for touched readers
// so SUM(ledger.amount) == outstanding_balance still holds afterwards
// (verify with `npm run db:reconcile-ledger`).

const UNMARKED_DEFAULT = "not_delivered" as const;

function monthAfter(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // m (1-based) as 0-based index = next month
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function calendarMonthRange(period: string): { start: string; end: string } {
  const [y, m] = period.split("-").map(Number);
  return {
    start: `${period}-01`,
    end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set (expected in .env.local)");
  const sql = postgres(url, { max: 1 });

  const today = new Date().toISOString().slice(0, 10);
  const currentPeriod = today.slice(0, 7);

  const readers = await sql`
    select r.id, r.center_id, c.city_id, ci.unit_id,
           to_char(r.subscription_start_date, 'YYYY-MM-DD') as sub_start,
           r.billing_anchor_day
    from readers r
    join centers c on r.center_id = c.id
    join cities ci on c.city_id = ci.id
    where r.status = 'active'`;
  console.log(`Loaded ${readers.length} active readers`);

  const existing = new Set(
    (
      await sql`
        select reader_id, billing_period
        from reader_billing_ledger
        where entry_type = 'period_charge' and billing_period is not null`
    ).map((r) => `${r.reader_id}:${r.billing_period}`)
  );

  const pricingByCity = new Map<number, PricePeriod[]>();
  for (const row of await sql`
    select city_id, price, to_char(effective_from, 'YYYY-MM-DD') as ef from city_pricing`) {
    if (!pricingByCity.has(row.city_id)) pricingByCity.set(row.city_id, []);
    pricingByCity.get(row.city_id)!.push({ price: Number(row.price), effectiveFrom: row.ef });
  }

  const overrideRows = await sql`
    select scope, scope_id, daily_price, to_char(for_date, 'YYYY-MM-DD') as for_date
    from pricing_overrides where active = true`;
  const ongoing = overrideRows.filter((r) => r.for_date == null);
  const dated = overrideRows.filter((r) => r.for_date != null);
  const findOngoing = (scope: string, scopeId: number | null) =>
    ongoing.find((r) => r.scope === scope && r.scope_id === scopeId)?.daily_price;
  const globalDefault = findOngoing("global", null);
  const datedDates = [...new Set(dated.map((r) => r.for_date as string))];

  function overridesFor(centerId: number, unitId: number) {
    const specialDayPrices: Record<string, number> = {};
    for (const forDate of datedDates) {
      const day = dated.filter((r) => r.for_date === forDate);
      const winner =
        day.find((r) => r.scope === "center" && r.scope_id === centerId) ??
        day.find((r) => r.scope === "unit" && r.scope_id === unitId) ??
        day.find((r) => r.scope === "global" && r.scope_id === null);
      if (winner) specialDayPrices[forDate] = Number(winner.daily_price);
    }
    const centerOverride = findOngoing("center", centerId);
    const unitOverride = findOngoing("unit", unitId);
    return {
      centerOverride: centerOverride != null ? Number(centerOverride) : null,
      unitOverride: unitOverride != null ? Number(unitOverride) : null,
      globalDefault: globalDefault != null ? Number(globalDefault) : null,
      specialDayPrices,
    };
  }

  const attByReader = new Map<number, Record<string, "delivered" | "not_delivered">>();
  for (const row of await sql`
    select reader_id, to_char(attendance_date, 'YYYY-MM-DD') as d, status from attendance`) {
    if (!attByReader.has(row.reader_id)) attByReader.set(row.reader_id, {});
    attByReader.get(row.reader_id)![row.d] = row.status;
  }

  const toInsert: {
    reader_id: number;
    entry_type: string;
    amount: string;
    billing_period: string;
    entry_date: string;
    description: string;
  }[] = [];
  const touchedReaders = new Set<number>();

  for (const r of readers) {
    const pricingHistory = pricingByCity.get(r.city_id) ?? [];
    const att = attByReader.get(r.id) ?? {};
    const ov = overridesFor(r.center_id, r.unit_id);

    let period = (r.sub_start as string).slice(0, 7);
    while (period < currentPeriod) {
      if (!existing.has(`${r.id}:${period}`)) {
        let cycleStart: string;
        let cycleEnd: string;
        if (r.billing_anchor_day) {
          ({ cycleStart, cycleEnd } = getBillingCycle(r.billing_anchor_day, `${period}-15`));
        } else {
          const rng = calendarMonthRange(period);
          cycleStart = rng.start;
          cycleEnd = rng.end;
        }

        const charge = calculateCycleCharge({
          cycleStart,
          cycleEnd,
          subscriptionStartDate: r.sub_start,
          attendance: att,
          pricingHistory,
          today: cycleEnd,
          unmarkedDefault: UNMARKED_DEFAULT,
          centerOverride: ov.centerOverride,
          unitOverride: ov.unitOverride,
          globalDefault: ov.globalDefault,
          specialDayPrices: ov.specialDayPrices,
        });

        if (charge > 0) {
          toInsert.push({
            reader_id: r.id,
            entry_type: "period_charge",
            amount: charge.toFixed(2),
            billing_period: period,
            entry_date: cycleEnd,
            description: `Backfilled period charge for ${period}`,
          });
          touchedReaders.add(r.id);
        }
      }
      period = monthAfter(period);
    }
  }

  console.log(
    `Computed ${toInsert.length} period_charge rows across ${touchedReaders.size} readers`
  );
  if (toInsert.length === 0) {
    await sql.end();
    return;
  }

  const cols = [
    "reader_id",
    "entry_type",
    "amount",
    "billing_period",
    "entry_date",
    "description",
  ] as const;
  const ids = [...touchedReaders];

  await sql.begin(async (tx) => {
    for (let i = 0; i < toInsert.length; i += 1000) {
      const batch = toInsert.slice(i, i + 1000);
      await tx`insert into reader_billing_ledger ${tx(batch, ...cols)} on conflict do nothing`;
    }
    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000);
      await tx`
        update readers r
        set outstanding_balance = coalesce(
          (select sum(l.amount) from reader_billing_ledger l where l.reader_id = r.id), 0)
        where r.id in ${tx(chunk)}`;
    }
  });

  const nullCheck = await sql`
    select count(*)::int as c from reader_billing_ledger
    where entry_type = 'period_charge' and billing_period is null`;
  console.log("period_charge rows with NULL billing_period:", nullCheck[0].c);
  console.log("Done.");
  await sql.end();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
