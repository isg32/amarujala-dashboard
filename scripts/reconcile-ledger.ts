import { config } from "dotenv";
config({ path: ".env.local" });
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { readers, readerBillingLedger } from "@/lib/db/schema";

const db = drizzle({ client: new Pool({ connectionString: process.env.DATABASE_URL }), schema: {} });

// Sanity check for the core billing invariant: readers.outstanding_balance
// must always equal SUM(reader_billing_ledger.amount) for that reader. Any
// mismatch means something wrote to outstanding_balance outside
// lib/billing/ledger.ts: postLedgerEntry().
async function main() {
  const rows = await db
    .select({
      readerId: readers.id,
      readerCode: readers.readerCode,
      balance: readers.outstandingBalance,
      ledgerSum: sql<string>`coalesce(sum(${readerBillingLedger.amount}), 0)`,
    })
    .from(readers)
    .leftJoin(readerBillingLedger, sql`${readerBillingLedger.readerId} = ${readers.id}`)
    .groupBy(readers.id);

  const mismatches = rows.filter((r) => Number(r.balance) !== Number(r.ledgerSum));

  if (mismatches.length === 0) {
    console.log(`OK — ${rows.length} reader(s) reconciled.`);
  } else {
    console.error(`MISMATCH in ${mismatches.length} reader(s):`);
    for (const m of mismatches) {
      console.error(`  ${m.readerCode}: balance=${m.balance} but ledger sum=${m.ledgerSum}`);
    }
    process.exitCode = 1;
  }
}

main().then(() => process.exit(process.exitCode ?? 0));
