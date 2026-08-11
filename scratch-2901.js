require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL });
const q = (sql, args) => p.query(sql, args).then((r) => r.rows);

(async () => {
  const ctx = (
    await q(
      `select r.id, r.name, r.reader_code, r.subscription_start_date, r.billing_anchor_day, r.status, r.outstanding_balance,
              c.id center_id, c.name center_name, city.id city_id, city.name city_name, u.id unit_id, u.name unit_name
       from readers r
       join centers c on c.id = r.center_id
       join cities city on city.id = c.city_id
       left join units u on u.id = city.unit_id
       where r.id = 2901`
    )
  )[0];
  console.log("CTX:", JSON.stringify(ctx, null, 2));

  const pricing = await q("select price, effective_from from city_pricing where city_id = $1 order by effective_from", [ctx.city_id]);
  console.log("CITY PRICING:", pricing);

  const overrides = await q(
    `select scope, scope_id, daily_price, for_date, active from pricing_overrides where active = true`
  );
  console.log("ALL ACTIVE OVERRIDES:", overrides);

  const att = await q("select attendance_date, status from attendance where reader_id = 2901 order by attendance_date");
  console.log("ATTENDANCE COUNT:", att.length);
  console.log("ATTENDANCE:", att);

  const ledger = await q(
    "select entry_type, amount, billing_period, entry_date, description from reader_billing_ledger where reader_id = 2901 order by entry_date"
  );
  console.log("LEDGER:", ledger);

  await p.end();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});