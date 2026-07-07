# Amar Ujala Reader Dashboard

A Reader Management Dashboard for a newspaper distribution business: manages readers, subscriptions, city-wise pricing, daily delivery attendance, payments, coupons, and reporting across an organization hierarchy (Zone → Unit → City → Center → POC → Reader).

If you're looking for **how to use the app day-to-day**, read **[HANDBOOK.md](./HANDBOOK.md)** instead — it's written for non-technical staff. This README is for people running, deploying, or developing the app.

## Features

- **Reader management** — profiles, directory with search/filters, single-add and bulk Excel upload, transfer between centers
- **Delivery attendance** — daily marking per reader, and admin bulk-marking by Center / City / Unit / whole organization
- **Billing** — city-wise price history, automatic monthly charge calculation from attendance, an auditable ledger, and an admin "Close Month" action
- **Payments** — record cash/UPI/bank/other payments, reverse mistaken entries, generate PayU online payment links, and download PDF receipts
- **Coupons** — fixed-amount discounts, create and apply to readers
- **SMS** — live payment reminders and payment links via the VISPL gateway (DLT-compliant templates)
- **Reports & export** — 8 report types (reader, dues, collections, attendance, city/center/POC-wise, monthly summary), exportable to Excel/CSV
- **Org hierarchy management** — Zones, Units, Cities, Centers, city pricing, POC and Administrator accounts, all with full create/delete
- **Two roles** — Administrator (full access) and AU POC (scoped to their assigned Centers only)

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- [Neon Postgres](https://neon.tech) + [Drizzle ORM](https://orm.drizzle.team)
- [Neon Auth](https://neon.tech/docs/guides/neon-auth) for authentication
- [shadcn/ui](https://ui.shadcn.com) (Base UI variant) + Tailwind CSS
- [PayU](https://payu.in) for online payments, [VISPL](https://vispl.in) for SMS, [pdf-lib](https://pdf-lib.js.org) for invoices

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values, see below
npx drizzle-kit push          # sync the schema to your Neon database
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See `.env.example` for the full list. Summary:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `NEON_AUTH_BASE_URL` / `NEXT_PUBLIC_NEON_AUTH_URL` | Yes | From your Neon Auth project |
| `NEON_AUTH_COOKIE_SECRET` | Yes | 32+ chars — generate with `openssl rand -base64 32` |
| `PAYU_KEY` / `PAYU_SALT` | For online payments | **Production** PayU credentials — see the warning below |
| `PAYU_GATEWAY_ENABLED` | For online payments | Defaults to `false`. Real transactions only happen when this is `true` |
| `SMS_API_USERNAME` / `SMS_API_PASSWORD` | For SMS | VISPL bulk SMS credentials |

> **PayU is wired to a live production endpoint, not a sandbox.** `PAYU_GATEWAY_ENABLED` gates every place a payment link can be created; leave it `false` until you've manually tested the flow and are ready to accept real payments.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` / `npm run start` | Production build / serve |
| `npx tsc --noEmit` | Type-check |
| `npm run lint` | Lint |
| `npx drizzle-kit push` | Push schema changes to the database |
| `npm run db:seed` | Seed the org hierarchy + a bootstrap admin/POC (see [CLAUDE.md](./CLAUDE.md) for the one-time admin bootstrap steps) |
| `npm run db:seed-mock` | Populate demo readers, attendance, payments, and coupons for a non-empty dashboard |
| `npm run test:billing` | Run the billing calculation unit tests |
| `npm run db:reconcile-ledger` | Verify every reader's balance matches their ledger history |

## Roles

- **Administrator** — full access to every module, including org hierarchy setup, pricing, billing close, coupons, and account management.
- **AU POC** — scoped to the Centers they're assigned to. Can manage readers, attendance, and payments within those Centers only.

There's no public sign-up; Administrators create every account (see the Handbook for how).

## Status

### Done

- Auth, roles, and center-scoping (Administrator / AU POC)
- Org hierarchy: Zones, Units, Cities, Centers — full create + delete
- City-wise price history and the daily-rate billing formula
- Reader management: profile, directory/search/filters, single-add, bulk Excel upload, transfer between centers
- Delivery attendance: daily and bulk marking (Center/City/Unit/Org scopes)
- Billing: live provisional monthly total, admin "Close Month" action, immutable ledger with a reconciliation script
- Payments: record, reverse, cross-reader transaction view with filters and export
- Coupons: fixed-amount discounts, create/apply
- PDF invoice generation
- Live SMS (VISPL) for payment reminders and payment links, using DLT-approved templates
- PayU online payment gateway: payment links, hosted checkout redirect, webhook (hash-verified, idempotent, tamper-checked) — gated behind `PAYU_GATEWAY_ENABLED` (off by default; the provided key is a production key with no sandbox)
- Reports: 8 report types + dashboard KPIs, all export to Excel/CSV
- POC and Administrator account management, including custom or auto-generated passwords and account deletion
- Dark mode (follows OS preference), branded UI

### Not done / known gaps

- **PayU has not been exercised end-to-end against a real transaction.** The hash logic, webhook, and gated flow are built and were verified up to the point that requires real money; someone needs to deliberately set `PAYU_GATEWAY_ENABLED=true` and walk one real payment through `/pay` to confirm the last mile.
- **No "payment received" SMS/invoice notification.** There's no DLT-approved template registered for this message yet, so the webhook logs the invoice link instead of texting it. Needs a template registered with the SMS vendor.
- **No bulk "send payment link to many readers at once."** The old system had this; only single-reader payment links exist here so far.
- **Credential rotation.** The PayU salt and old PocketBase admin password were shared in plaintext chat during development and should be rotated before/soon after going live.
- **No versioned database migrations.** Schema changes are applied with `drizzle-kit push` directly; there's no migration history to roll back through.
- **No automated end-to-end test suite or CI pipeline.** Testing has been manual (Playwright, run ad hoc) plus unit tests for the billing formula (`npm run test:billing`) and a ledger reconciliation script. Nothing runs automatically on push.
- **No Postgres Row-Level Security.** Center-scoping is enforced entirely in the application's data-access layer (`lib/data/*.ts`), not at the database level — a deliberate v1 decision, revisit if a security review calls for defense-in-depth.
- **Reader status (Active/Inactive) has no dedicated toggle UI** beyond what's set when a reader is created.

## More documentation

- **[HANDBOOK.md](./HANDBOOK.md)** — plain-language guide to using the dashboard, for Administrators and POCs
- **[CLAUDE.md](./CLAUDE.md)** — architecture notes, data model rationale, and gotchas, for developers
- **[report.md](./report.md)** — the original functional requirements document
