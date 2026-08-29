# Changes Log

## 2026-08-29 — Ledger Format Revision & Close Subscription Enhancement

### 1. Ledger Format Revision (Reader Ledger Page)

**Files Modified:**
- `app/(dashboard)/readers/[id]/ledger/page.tsx`
- `app/(dashboard)/readers/[id]/ledger/export-csv-button.tsx`

**Changes:**
- Split "Billing Period" column into two columns: **Billing Year** (e.g., "2025") and **Billing Month** (e.g., "January", "February", ...)
- Renamed "Discounts" column to **"Discounts & Adjustments"**
- Removed "N/A" (notApplicable) column
- Updated table headers from 11 to 10 columns
- Updated CSV export to match new format

### 2. Close Subscription with Adjustment Option

**Files Modified:**
- `lib/data/billing.ts` — Added `writeOffPendingAsAdjustment` option to `closeSubscription()`
- `app/(dashboard)/billing/actions.ts` — Updated action to accept the option
- `app/(dashboard)/readers/[id]/close-subscription-button.tsx` — Added UI with checkbox and pending amount display

**Changes:**
- New `CloseSubscriptionOptions` interface with `writeOffPendingAsAdjustment?: boolean`
- When enabled and pending amount > 0: posts an `adjustment` entry (negative amount) instead of `period_charge`
- When disabled (default): posts `period_charge` for delivered papers as before
- UI shows pending amount and checkbox "Write off as adjustment"
- No threshold — admin can write off any amount

### 3. Ledger Enum Rename: `monthly_charge` → `period_charge`

**Files Modified:**
- `lib/db/schema.ts` — Updated enum definition
- `drizzle/0001_rename_monthly_charge_to_period_charge.sql` — New migration file
- `lib/billing/ledger.ts` — Updated `LedgerEntryType`
- `lib/data/billing.ts` — All queries and references updated
- `lib/data/reports.ts` — All queries and references updated
- `scripts/seed-mock-data.ts` — Updated seed script
- `app/(dashboard)/readers/[id]/ledger/page.tsx` — Updated display label
- `app/(dashboard)/readers/[id]/page.tsx` — Updated display label

**Migration Details:**
The migration creates a new enum type `ledger_entry_type_new` with `period_charge`, migrates existing data, drops the old type, and renames the new type to `ledger_entry_type`. Also updates the unique index `ledger_reader_period_charge_idx` to reference `period_charge`.

**Note:** Run `npm run db:migrate` (or `drizzle-kit migrate`) to apply the migration.

### Summary of Files Changed

| File | Type |
|------|------|
| `app/(dashboard)/readers/[id]/ledger/page.tsx` | Modified |
| `app/(dashboard)/readers/[id]/ledger/export-csv-button.tsx` | Modified |
| `app/(dashboard)/billing/actions.ts` | Modified |
| `app/(dashboard)/readers/[id]/close-subscription-button.tsx` | Modified |
| `app/(dashboard)/readers/[id]/page.tsx` | Modified |
| `lib/data/billing.ts` | Modified |
| `lib/data/reports.ts` | Modified |
| `lib/billing/ledger.ts` | Modified |
| `lib/db/schema.ts` | Modified |
| `scripts/seed-mock-data.ts` | Modified |
| `drizzle/0001_rename_monthly_charge_to_period_charge.sql` | **New** |