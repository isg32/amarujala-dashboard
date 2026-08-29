import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

// One-off: older `payment` / `coupon_discount` / `adjustment` ledger rows were
// written with billing_period = NULL, so getReaderMonthlyLedger() lumped them
// into a single "Uncategorized" row and the month they actually belong to never
// appeared in the Monthly Ledger table or its CSV export. This tags each such
// row with its calendar month:
//   - payment / coupon_discount  -> month of entry_date
//   - adjustment (payment reversal) -> month of the payment it reverses
//       (reference_id -> payments.id), so the pair nets out in one month row;
//       falls back to entry_date month if the payment can't be resolved.
// Amounts are untouched, so SUM(ledger.amount) == outstanding_balance still
// holds (verify with `npm run db:reconcile-ledger`).

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set (expected in .env.local)");
  const sql = postgres(url, { max: 1 });

  const before = await sql`
    select entry_type, count(*) c
    from reader_billing_ledger
    where billing_period is null
    group by entry_type order by entry_type`;
  console.log("NULL billing_period rows before:", before);

  const result = await sql.begin(async (tx) => {
    const adj = await tx`
      update reader_billing_ledger l
      set billing_period = coalesce(
        to_char(p.payment_date, 'YYYY-MM'),
        to_char(l.entry_date, 'YYYY-MM')
      )
      from payments p
      where l.reference_id = p.id
        and l.entry_type = 'adjustment'
        and l.billing_period is null`;

    const rest = await tx`
      update reader_billing_ledger
      set billing_period = to_char(entry_date, 'YYYY-MM')
      where billing_period is null
        and entry_type in ('payment', 'coupon_discount', 'adjustment')`;

    return { adjustments: adj.count, others: rest.count };
  });
  console.log("Updated:", result);

  const after = await sql`
    select count(*) c from reader_billing_ledger where billing_period is null`;
  console.log("NULL billing_period rows after:", after[0].c);

  await sql.end();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
