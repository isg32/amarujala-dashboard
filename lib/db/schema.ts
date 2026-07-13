import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  char,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const appRoleEnum = pgEnum("app_role", ["admin", "au_poc"]);
export const readerStatusEnum = pgEnum("reader_status", ["active", "inactive"]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "delivered",
  "not_delivered",
]);
export const bulkScopeEnum = pgEnum("bulk_scope", [
  "reader",
  "center",
  "city",
  "unit",
  "org",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "upi",
  "bank_transfer",
  "razorpay",
  "payu",
  "other",
]);
export const paymentIntentStatusEnum = pgEnum("payment_intent_status", [
  "pending",
  "success",
  "failed",
]);
export const smsTemplateTypeEnum = pgEnum("sms_template_type", ["reminder", "payment_link"]);

export const pricingOverrideScopeEnum = pgEnum("pricing_override_scope", [
  "global",
  "unit",
  "center",
]);
export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "monthly_charge",
  "payment",
  "coupon_discount",
  "adjustment",
]);

export const zones = pgTable("zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const units = pgTable("units", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone_id")
    .notNull()
    .references(() => zones.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cities = pgTable("cities", {
  id: serial("id").primaryKey(),
  unitId: integer("unit_id")
    .notNull()
    .references(() => units.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const centers = pgTable("centers", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id")
    .notNull()
    .references(() => cities.id),
  name: text("name").notNull(),
  address: text("address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// id = Neon Auth user id (text), not a serial — this table is keyed by the
// auth provider's identity since Neon Auth sessions carry no role/custom data.
export const appUsers = pgTable("app_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: appRoleEnum("role").notNull(),
  // Login stays intact and every read stays scoped exactly as before — this
  // only blocks writes (see lib/auth/session.ts's getCurrentAppUser, which
  // forces every poc_permissions flag to false when this is set, and the
  // explicit check in app/(dashboard)/readers/[id]/reminder-actions.ts for
  // the one write path that isn't gated by a permissions flag). A softer
  // alternative to deletePoc for "this person shouldn't act right now but
  // keep their history/access intact."
  suspended: boolean("suspended").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Per-POC write permissions, one row per au_poc user, created/updated only
// when an admin actually customizes them — see lib/auth/session.ts's
// getCurrentAppUser(), which treats a missing row as "all true" so every
// POC created before this feature existed keeps its current full-write
// access with no migration needed.
export const pocPermissions = pgTable("poc_permissions", {
  pocUserId: text("poc_user_id")
    .primaryKey()
    .references(() => appUsers.id),
  canRecordPayments: boolean("can_record_payments").notNull().default(true),
  canMarkAttendance: boolean("can_mark_attendance").notNull().default(true),
  canAddReaders: boolean("can_add_readers").notNull().default(true),
});

// Admin-editable overrides for the two DLT-registered SMS templates (see
// lib/sms/send-reminder.ts). A missing row = the original registered text
// (DEFAULT_TEMPLATES there), same "missing row is the safe default" pattern
// as poc_permissions above.
export const smsTemplates = pgTable("sms_templates", {
  type: smsTemplateTypeEnum("type").primaryKey(),
  template: text("template").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => appUsers.id),
});

export const pocCenters = pgTable(
  "poc_centers",
  {
    pocUserId: text("poc_user_id")
      .notNull()
      .references(() => appUsers.id),
    centerId: integer("center_id")
      .notNull()
      .references(() => centers.id),
  },
  (table) => [primaryKey({ columns: [table.pocUserId, table.centerId] })]
);

// History table, never a single current-price column: a city's price can
// change over time, and past months must bill at the price active then.
export const cityPricing = pgTable("city_pricing", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id")
    .notNull()
    .references(() => cities.id),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  effectiveFrom: date("effective_from").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Flat per-day rate overrides ("Day Rates") layered on top of city_pricing:
// a Center or Unit override pins the daily rate outright for every day
// billed under that scope, bypassing city pricing history entirely; a
// "global" row (scopeId null) is the org-wide fallback used only when a
// city has no price configured at all. scopeId is polymorphic (points at
// units.id or centers.id depending on scope) — same intentionally-FK-less
// pattern as attendance_bulk_runs.scope_id.
export const pricingOverrides = pgTable("pricing_overrides", {
  id: serial("id").primaryKey(),
  scope: pricingOverrideScopeEnum("scope").notNull(),
  scopeId: integer("scope_id"),
  dailyPrice: numeric("daily_price", { precision: 10, scale: 2 }).notNull(),
  // Null = ongoing override (the original "Day Rates" behavior). A specific
  // date = a one-day-only price hike (e.g. a festival) that outranks even an
  // ongoing Center/Unit override for that single date — see
  // lib/billing/calculate.ts's resolveDailyRate() and
  // lib/data/billing.ts's getPriceOverridesFor().
  forDate: date("for_date"),
  active: boolean("active").notNull().default(true),
  createdBy: text("created_by")
    .notNull()
    .references(() => appUsers.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const readers = pgTable("readers", {
  id: serial("id").primaryKey(),
  readerCode: text("reader_code").notNull().unique(),
  name: text("name").notNull(),
  mobile: text("mobile").notNull(),
  email: text("email"),
  address: text("address").notNull(),
  landmark: text("landmark"),
  centerId: integer("center_id")
    .notNull()
    .references(() => centers.id),
  assignedPocId: text("assigned_poc_id").references(() => appUsers.id),
  subscriptionStartDate: date("subscription_start_date").notNull(),
  // 1-28, null = calendar-month billing (the default). When set, this
  // reader's billing cycle runs [anchorDay .. anchorDay-1 of next month]
  // instead of the 1st-to-end-of-month everyone else uses — see
  // lib/billing/calculate.ts's getBillingCycle() and
  // lib/data/billing.ts's closeReaderCycle().
  billingAnchorDay: integer("billing_anchor_day"),
  status: readerStatusEnum("status").notNull().default("active"),
  remarks: text("remarks"),
  outstandingBalance: numeric("outstanding_balance", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: text("created_by")
    .notNull()
    .references(() => appUsers.id),
});

export const readerTransfers = pgTable("reader_transfers", {
  id: serial("id").primaryKey(),
  readerId: integer("reader_id")
    .notNull()
    .references(() => readers.id),
  fromCenterId: integer("from_center_id")
    .notNull()
    .references(() => centers.id),
  toCenterId: integer("to_center_id")
    .notNull()
    .references(() => centers.id),
  transferredAt: timestamp("transferred_at").notNull().defaultNow(),
  transferredBy: text("transferred_by")
    .notNull()
    .references(() => appUsers.id),
  remarks: text("remarks"),
});

export const attendance = pgTable(
  "attendance",
  {
    id: serial("id").primaryKey(),
    readerId: integer("reader_id")
      .notNull()
      .references(() => readers.id),
    attendanceDate: date("attendance_date").notNull(),
    status: attendanceStatusEnum("status").notNull(),
    markedBy: text("marked_by")
      .notNull()
      .references(() => appUsers.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("attendance_reader_date_idx").on(
      table.readerId,
      table.attendanceDate
    ),
  ]
);

// Audit trail of bulk-mark actions; the attendance rows themselves are
// still the source of truth, this just records who triggered a bulk mark
// and over what scope.
export const attendanceBulkRuns = pgTable("attendance_bulk_runs", {
  id: serial("id").primaryKey(),
  scope: bulkScopeEnum("scope").notNull(),
  scopeId: integer("scope_id"),
  dateFrom: date("date_from").notNull(),
  dateTo: date("date_to").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => appUsers.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  readerId: integer("reader_id")
    .notNull()
    .references(() => readers.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull(),
  methodOtherLabel: text("method_other_label"),
  transactionReference: text("transaction_reference"),
  remarks: text("remarks"),
  paymentDate: date("payment_date").notNull(),
  recordedBy: text("recorded_by")
    .notNull()
    .references(() => appUsers.id),
  reversed: boolean("reversed").notNull().default(false),
  // Manual payments only (cash/UPI/bank transfer/other) — self-reported by a
  // POC/admin, not independently verified the way PayU/Razorpay are. Posts
  // to the ledger immediately like any other payment; this just flags it for
  // admin follow-up (find it in Payment History, reverse if it turns out the
  // cash/cheque never actually cleared) rather than blocking the balance.
  inProcess: boolean("in_process").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A PayU payment link generated for a reader. Public/unauthenticated
// routes (app/pay/*, the PayU webhook) key off txnId, never the reader's
// internal id directly, so a leaked link only exposes this one intent.
export const paymentIntents = pgTable("payment_intents", {
  id: serial("id").primaryKey(),
  readerId: integer("reader_id")
    .notNull()
    .references(() => readers.id),
  txnId: text("txn_id").notNull().unique(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  status: paymentIntentStatusEnum("status").notNull().default("pending"),
  createdBy: text("created_by")
    .notNull()
    .references(() => appUsers.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  paidAt: timestamp("paid_at"),
});

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull(),
  // Null = unlimited (the default, so every existing coupon keeps working
  // unchanged). When set, this is the total ₹ this coupon can ever give away
  // across all readers — applyCoupon() in lib/data/coupons.ts refuses once
  // SUM(reader_coupons.applied_amount) for this coupon would exceed it.
  totalBudget: numeric("total_budget", { precision: 10, scale: 2 }),
  active: boolean("active").notNull().default(true),
  createdBy: text("created_by")
    .notNull()
    .references(() => appUsers.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const readerCoupons = pgTable("reader_coupons", {
  id: serial("id").primaryKey(),
  couponId: integer("coupon_id")
    .notNull()
    .references(() => coupons.id),
  readerId: integer("reader_id")
    .notNull()
    .references(() => readers.id),
  appliedAmount: numeric("applied_amount", { precision: 10, scale: 2 }).notNull(),
  appliedBy: text("applied_by")
    .notNull()
    .references(() => appUsers.id),
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
  remarks: text("remarks"),
});

// Append-only. readers.outstanding_balance is a running total maintained
// alongside this table (same transaction, via lib/billing/ledger.ts), never
// mutated anywhere else — this table is what makes that total auditable.
// The partial unique index prevents ever double-billing a reader for the
// same month even if a "Close Month" action is accidentally triggered twice.
export const readerBillingLedger = pgTable(
  "reader_billing_ledger",
  {
    id: serial("id").primaryKey(),
    readerId: integer("reader_id")
      .notNull()
      .references(() => readers.id),
    entryType: ledgerEntryTypeEnum("entry_type").notNull(),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    billingPeriod: char("billing_period", { length: 7 }), // 'YYYY-MM'
    // The date this financial event actually happened (e.g. the payment
    // date entered on the Record Payment form, which can be backdated) —
    // distinct from createdAt below, which is when the row was written and
    // can lag behind entryDate for a backdated entry. Defaults to today's
    // date at the call site (lib/billing/ledger.ts) when not given.
    entryDate: date("entry_date").notNull().defaultNow(),
    referenceId: integer("reference_id"),
    description: text("description"),
    createdBy: text("created_by").references(() => appUsers.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ledger_reader_period_charge_idx")
      .on(table.readerId, table.billingPeriod)
      .where(sql`${table.entryType} = 'monthly_charge'`),
  ]
);
