-- Rename ledger_entry_type enum value 'monthly_charge' to 'period_charge'
-- PostgreSQL requires creating a new enum type, migrating data, and dropping the old type

-- 1. Create new enum type with renamed value
CREATE TYPE "public"."ledger_entry_type_new" AS ENUM('period_charge', 'payment', 'coupon_discount', 'adjustment');

-- 2. Update column to use new type (via temporary text column)
ALTER TABLE "public"."reader_billing_ledger" 
  ALTER COLUMN "entry_type" TYPE "public"."ledger_entry_type_new" 
  USING CASE 
    WHEN "entry_type" = 'monthly_charge' THEN 'period_charge'::"public"."ledger_entry_type_new"
    ELSE "entry_type"::text::"public"."ledger_entry_type_new"
  END;

-- 3. Drop old enum type
DROP TYPE "public"."ledger_entry_type";

-- 4. Rename new type to original name
ALTER TYPE "public"."ledger_entry_type_new" RENAME TO "ledger_entry_type";

-- 5. Recreate the unique index with updated value reference
DROP INDEX IF EXISTS "public"."ledger_reader_period_charge_idx";
CREATE UNIQUE INDEX "ledger_reader_period_charge_idx" ON "reader_billing_ledger" USING btree ("reader_id","billing_period") WHERE "reader_billing_ledger"."entry_type" = 'period_charge';