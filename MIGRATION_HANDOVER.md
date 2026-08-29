# Migration Handover Document

## Summary
This document describes the changes made to the billing ledger system and the steps needed to complete the migration on production.

---

## Changes Made

### 1. Ledger Format Revision (Reader Ledger Page)
**Files Modified:**
- `app/(dashboard)/readers/[id]/ledger/page.tsx` - Main ledger display
- `app/(dashboard)/readers/[id]/ledger/export-csv-button.tsx` - CSV export

**Changes:**
- Split "Billing Period" column into **Billing Year** (e.g., "2025") and **Billing Month** (e.g., "January")
- Renamed "Discounts" → **"Discounts & Adjustments"**
- Removed "N/A" (notApplicable) column
- Updated table headers from 11 to 10 columns
- CSV export matches new format

### 2. Close Subscription with Adjustment Option
**Files Modified:**
- `lib/data/billing.ts` - Added `writeOffPendingAsAdjustment` option to `closeSubscription()`
- `app/(dashboard)/billing/actions.ts` - Updated action to pass the option
- `app/(dashboard)/readers/[id]/close-subscription-button.tsx` - Added UI with pending amount display and checkbox

**Features:**
- When `writeOffPendingAsAdjustment=true` and pending > 0: posts an `adjustment` entry (negative amount) instead of `period_charge`
- No threshold - admin can write off any amount
- UI shows pending amount and "Write off as adjustment" checkbox

### 3. Ledger Enum Rename: `monthly_charge` → `period_charge`
**Files Modified:**
- `lib/db/schema.ts` - Updated enum definition
- `drizzle/0001_rename_monthly_charge_to_period_charge.sql` - Migration file
- `lib/billing/ledger.ts` - Updated `LedgerEntryType`
- `lib/data/billing.ts` - All queries and references updated
- `lib/data/reports.ts` - All queries and references updated
- `scripts/seed-mock-data.ts` - Updated seed script
- `app/(dashboard)/readers/[id]/ledger/page.tsx` - Updated display label
- `app/(dashboard)/readers/[id]/page.tsx` - Updated display label

**Migration Strategy (Fixed for Production):**
The migration uses a temp column approach to avoid Postgres enum comparison issues:

```sql
-- 1. New enum type already created: ledger_entry_type_new (period_charge, payment, coupon_discount, adjustment)
-- 2. Add temp text column
ALTER TABLE "reader_billing_ledger" ADD COLUMN "entry_type_temp" text;

-- 3. Copy data with conversion
UPDATE "reader_billing_ledger" 
SET "entry_type_temp" = CASE 
  WHEN "entry_type"::text = 'monthly_charge' THEN 'period_charge'
  ELSE "entry_type"::text
END;

-- 4. Drop old column
ALTER TABLE "reader_billing_ledger" DROP COLUMN "entry_type";

-- 5. Rename temp column
ALTER TABLE "reader_billing_ledger" RENAME COLUMN "entry_type_temp" TO "entry_type";

-- 6. Set column to new enum type
ALTER TABLE "reader_billing_ledger" ALTER COLUMN "entry_type" TYPE "ledger_entry_type_new" USING "entry_type"::"ledger_entry_type_new";

-- 7. Drop old enum type
DROP TYPE "ledger_entry_type";

-- 8. Rename new type to original name
ALTER TYPE "ledger_entry_type_new" RENAME TO "ledger_entry_type";

-- 9. Recreate unique index
DROP INDEX IF EXISTS "ledger_reader_period_charge_idx";
CREATE UNIQUE INDEX "ledger_reader_period_charge_idx" ON "reader_billing_ledger" USING btree ("reader_id","billing_period") WHERE "entry_type" = 'period_charge';
```

---

## Production Migration Status

### ✅ Completed on Production Database
- Enum renamed: `monthly_charge` → `period_charge` (verified via script)
- Ledger reconciled: 3520 readers OK
- All 28 billing unit tests pass
- Build succeeds

### ⚠️ Historical Data Backfill (IN PROGRESS)
**Issue:** Most readers only show 1 ledger entry (current month) because "Close Month" was never run for historical periods. The new system computes charges on-the-fly but doesn't create historical `period_charge` entries automatically.

**Script Created:** `scripts/backfill-period-charges.ts`

**What it does:**
1. For each active reader, finds the last posted `period_charge`
2. Backfills all missing historical periods from subscription start (or last charge) up to current month
3. Calculates charges based on actual attendance for each period
4. Posts `period_charge` entries with proper billing period

**Progress:** Started running, posted entries for ~15 readers so far. Needs to complete for all 3,474 active readers.

**To Resume Backfill:**
```bash
cd /home/isg32/dev/websites/Amarujala-dashboard
# DATABASE_URL is read from .env.local (or your shell); never inline a real
# connection string here. Use Neon's DIRECT (non-pooler) string for scripts.
DATABASE_URL="$DATABASE_URL" npx tsx scripts/backfill-period-charges.ts
```

**Note:** The script uses a local DB pool (not server-only imports) so it runs standalone.

---

## Verification Commands

```bash
# Run billing tests
npm run test:billing

# Reconcile ledger (check balance = sum of ledger)
npm run db:reconcile-ledger

# Build
npm run build

# Check enum values on production
DATABASE_URL="..." npx tsx -e "
import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const result = await sql\\`SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ledger_entry_type')\\`;
console.log(result);
await sql.end();
"
```

---

## Files to Deploy
All changes are committed to `main` branch. The Vercel deployment will pick up the code changes automatically. The production database migration has been applied manually.

**Key files changed:**
- `app/(dashboard)/readers/[id]/ledger/page.tsx`
- `app/(dashboard)/readers/[id]/ledger/export-csv-button.tsx`
- `app/(dashboard)/billing/actions.ts`
- `app/(dashboard)/readers/[id]/close-subscription-button.tsx`
- `app/(dashboard)/readers/[id]/page.tsx`
- `lib/data/billing.ts`
- `lib/data/reports.ts`
- `lib/billing/ledger.ts`
- `lib/db/schema.ts`
- `scripts/seed-mock-data.ts`
- `drizzle/0001_rename_monthly_charge_to_period_charge.sql` (updated migration)
- `scripts/backfill-period-charges.ts` (new backfill script)

---

## Next Steps for Handover

1. **Complete the backfill** - Run the backfill script to completion for all readers
2. **Verify ledger display** - Check `/readers/[id]/ledger` shows historical months
3. **Test close subscription** - Test both normal close and "write off as adjustment" option
4. **Deploy to Vercel** - Code is ready, just needs deployment trigger