CREATE TYPE "public"."app_role" AS ENUM('admin', 'au_poc');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('delivered', 'not_delivered');--> statement-breakpoint
CREATE TYPE "public"."bulk_scope" AS ENUM('reader', 'center', 'city', 'unit', 'org');--> statement-breakpoint
CREATE TYPE "public"."ledger_entry_type" AS ENUM('monthly_charge', 'payment', 'coupon_discount', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."payment_intent_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'upi', 'bank_transfer', 'razorpay', 'payu', 'other');--> statement-breakpoint
CREATE TYPE "public"."pricing_override_scope" AS ENUM('global', 'unit', 'center');--> statement-breakpoint
CREATE TYPE "public"."reader_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."sms_template_type" AS ENUM('reminder', 'payment_link', 'payment_confirmation');--> statement-breakpoint
CREATE TABLE "app_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "app_role" NOT NULL,
	"suspended" boolean DEFAULT false NOT NULL,
	"can_manage_admin_passwords" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"reader_id" integer NOT NULL,
	"attendance_date" date NOT NULL,
	"status" "attendance_status" NOT NULL,
	"marked_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_bulk_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" "bulk_scope" NOT NULL,
	"scope_id" integer,
	"date_from" date NOT NULL,
	"date_to" date NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "centers" (
	"id" serial PRIMARY KEY NOT NULL,
	"city_id" integer NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"unit_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_pricing" (
	"id" serial PRIMARY KEY NOT NULL,
	"city_id" integer NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"discount_amount" numeric(10, 2) NOT NULL,
	"total_budget" numeric(10, 2),
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" serial PRIMARY KEY NOT NULL,
	"reader_id" integer NOT NULL,
	"txn_id" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "payment_intent_status" DEFAULT 'pending' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	CONSTRAINT "payment_intents_txn_id_unique" UNIQUE("txn_id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"reader_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"method_other_label" text,
	"transaction_reference" text,
	"remarks" text,
	"payment_date" date NOT NULL,
	"recorded_by" text NOT NULL,
	"reversed" boolean DEFAULT false NOT NULL,
	"in_process" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poc_centers" (
	"poc_user_id" text NOT NULL,
	"center_id" integer NOT NULL,
	CONSTRAINT "poc_centers_poc_user_id_center_id_pk" PRIMARY KEY("poc_user_id","center_id")
);
--> statement-breakpoint
CREATE TABLE "poc_permissions" (
	"poc_user_id" text PRIMARY KEY NOT NULL,
	"can_record_payments" boolean DEFAULT true NOT NULL,
	"can_mark_attendance" boolean DEFAULT true NOT NULL,
	"can_add_readers" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" "pricing_override_scope" NOT NULL,
	"scope_id" integer,
	"daily_price" numeric(10, 2) NOT NULL,
	"for_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reader_billing_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"reader_id" integer NOT NULL,
	"entry_type" "ledger_entry_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"billing_period" char(7),
	"entry_date" date DEFAULT now() NOT NULL,
	"reference_id" integer,
	"description" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reader_coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"coupon_id" integer NOT NULL,
	"reader_id" integer NOT NULL,
	"applied_amount" numeric(10, 2) NOT NULL,
	"applied_by" text NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "reader_transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"reader_id" integer NOT NULL,
	"from_center_id" integer NOT NULL,
	"to_center_id" integer NOT NULL,
	"transferred_at" timestamp DEFAULT now() NOT NULL,
	"transferred_by" text NOT NULL,
	"remarks" text
);
--> statement-breakpoint
CREATE TABLE "readers" (
	"id" serial PRIMARY KEY NOT NULL,
	"reader_code" text NOT NULL,
	"name" text NOT NULL,
	"mobile" text NOT NULL,
	"email" text,
	"address" text NOT NULL,
	"landmark" text,
	"center_id" integer NOT NULL,
	"assigned_poc_id" text,
	"subscription_start_date" date NOT NULL,
	"billing_anchor_day" integer,
	"status" "reader_status" DEFAULT 'active' NOT NULL,
	"remarks" text,
	"outstanding_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	CONSTRAINT "readers_reader_code_unique" UNIQUE("reader_code"),
	CONSTRAINT "readers_mobile_unique" UNIQUE("mobile")
);
--> statement-breakpoint
CREATE TABLE "sms_templates" (
	"type" "sms_template_type" PRIMARY KEY NOT NULL,
	"template" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" serial PRIMARY KEY NOT NULL,
	"zone_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_marked_by_app_users_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_bulk_runs" ADD CONSTRAINT "attendance_bulk_runs_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "centers" ADD CONSTRAINT "centers_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "city_pricing" ADD CONSTRAINT "city_pricing_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_app_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poc_centers" ADD CONSTRAINT "poc_centers_poc_user_id_app_users_id_fk" FOREIGN KEY ("poc_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poc_centers" ADD CONSTRAINT "poc_centers_center_id_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poc_permissions" ADD CONSTRAINT "poc_permissions_poc_user_id_app_users_id_fk" FOREIGN KEY ("poc_user_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pricing_overrides" ADD CONSTRAINT "pricing_overrides_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_billing_ledger" ADD CONSTRAINT "reader_billing_ledger_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_billing_ledger" ADD CONSTRAINT "reader_billing_ledger_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_coupons" ADD CONSTRAINT "reader_coupons_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_coupons" ADD CONSTRAINT "reader_coupons_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_coupons" ADD CONSTRAINT "reader_coupons_applied_by_app_users_id_fk" FOREIGN KEY ("applied_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_transfers" ADD CONSTRAINT "reader_transfers_reader_id_readers_id_fk" FOREIGN KEY ("reader_id") REFERENCES "public"."readers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_transfers" ADD CONSTRAINT "reader_transfers_from_center_id_centers_id_fk" FOREIGN KEY ("from_center_id") REFERENCES "public"."centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_transfers" ADD CONSTRAINT "reader_transfers_to_center_id_centers_id_fk" FOREIGN KEY ("to_center_id") REFERENCES "public"."centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_transfers" ADD CONSTRAINT "reader_transfers_transferred_by_app_users_id_fk" FOREIGN KEY ("transferred_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readers" ADD CONSTRAINT "readers_center_id_centers_id_fk" FOREIGN KEY ("center_id") REFERENCES "public"."centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readers" ADD CONSTRAINT "readers_assigned_poc_id_app_users_id_fk" FOREIGN KEY ("assigned_poc_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readers" ADD CONSTRAINT "readers_created_by_app_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_templates" ADD CONSTRAINT "sms_templates_updated_by_app_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_reader_date_idx" ON "attendance" USING btree ("reader_id","attendance_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_reader_period_charge_idx" ON "reader_billing_ledger" USING btree ("reader_id","billing_period") WHERE "reader_billing_ledger"."entry_type" = 'monthly_charge';