# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Reader Management Dashboard: a Next.js (App Router) app for a newspaper distribution business to manage readers, subscriptions, city-wise pricing, delivery attendance, payments, coupons, and reporting across an org hierarchy (Zone → Unit → City → Center → POC → Reader), with two roles (Administrator, AU POC scoped to assigned Centers). `report.md` is the original FRD — treat it as the source of truth for product requirements not covered below.

The full implementation plan (data model rationale, billing formula, confirmed FRD ambiguity decisions, build order) lives at `/home/isg32/.claude/plans/could-you-read-report-md-compressed-hamming.md`.

## Commands

- `npm run dev` — start dev server (Turbopack)
- `npm run build` / `npm run start` — production build/serve
- `npx tsc --noEmit` — type-check
- `npx drizzle-kit push` — push `lib/db/schema.ts` changes to the Neon database (no migration files yet; using push-based sync)
- `npx shadcn@latest add <component>` — add a shadcn/ui component

## Important: this is not the Next.js you know

This project is on Next.js 16, which has real breaking changes from the version most training data assumes. Before writing Next.js-specific code (routing, server actions, caching, middleware), check `node_modules/next/dist/docs/` for the current API. Two changes already bit us once:

- **`middleware.ts` is renamed to `proxy.ts`.** The file conventions doc is at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.
- **Cache Components (`cacheComponents: true` in `next.config.ts`) is opt-in and currently disabled.** Every page in this app is inherently per-user/per-role dynamic (reads the session, scopes data by center), so there's no static-shell benefit here — don't enable it without reconsidering the whole rendering model.

## Architecture

**Auth (Neon Auth, `@neondatabase/auth`):** The session object from Neon Auth carries only `{id, name, email, image, emailVerified}` — **no role or custom metadata**. Role and POC↔Center assignment live in our own `app_users` / `poc_centers` tables, keyed by the Neon Auth user id.

- `lib/auth/server.ts` — the `auth` singleton from `createNeonAuth()` (package path: `@neondatabase/auth/next/server`, not `@neondatabase/auth/next` — the setup guide is misleading here). Exposes `auth.getSession()`, `auth.handler()`, `auth.middleware()`.
- `app/api/auth/[...path]/route.ts` — mounts `auth.handler()`.
- `proxy.ts` — wraps `auth.middleware({ loginUrl: "/auth/sign-in" })` but **only invokes it for GET/HEAD requests**. `auth.middleware()`'s cookie-cache session revalidation was observed to misfire on the multipart POST that Server Actions use, redirecting an *authenticated* mutation to sign-in — confirmed via a real Playwright browser session, not just curl (curl can't distinguish a library bug from CSRF-style Origin-header rejection). POST/PUT/DELETE bypass the middleware entirely and rely on `requireAdmin()`/`requireAppUser()` inside each Server Action, which is the real authorization boundary anyway (matches Next's own guidance: Proxy is an optimistic check, not the enforcement point).
- `lib/auth/client.ts` — `authClient` for client components (`authClient.useSession()`).
- `app/auth-provider.tsx` + `app/auth/[path]/page.tsx` — pre-built Neon Auth UI (sign-in/up/reset/etc via `AuthView`).
- **Route-group gotcha:** `app/(dashboard)/page.tsx` resolves to `/`, not `/dashboard` — route groups (parens) don't add a path segment. The dashboard home page is deliberately at `app/(dashboard)/dashboard/page.tsx` so the URL is `/dashboard` (matching where the Neon Auth UI's sign-in form navigates by default); `app/(dashboard)/page.tsx` is a thin `redirect("/dashboard")` for the bare `/` route.

**AU POC provisioning (in `lib/data/master-data.ts: createPoc()`):** Creating another user's login server-side via `auth.admin.createUser()` requires the *calling* session to already hold Neon Auth's own internal admin role — this is separate from our `app_users.role` column and can't be granted through the app itself. One-time bootstrap for the first Administrator:
1. Sign up normally via `/auth/sign-up` (or POST `/api/auth/sign-up/email`).
2. `npx neonctl neon-auth user set-role <user-id> --roles admin --project-id purple-leaf-62224640` (grants the underlying Neon Auth admin role).
3. Insert their `app_users` row with `role: 'admin'` (see `scripts/seed.ts` — the bootstrap admin's id/email are hardcoded there).

After that, `createPoc()` works from within the app for every subsequent AU POC — no further CLI steps needed. Bootstrapped admin: `dishadashboard0012@gmail.com` (Neon Auth user id `306c8cf6-ad7a-47a6-8e97-e0a3b4c2575b`).

**Data access — the scoping chokepoint:** `lib/data/*.ts` (one file per aggregate: `master-data`, `readers`, `attendance`, `billing`, `payments`, `coupons`, `reports`) is the *only* place those tables are queried from. Every function calls `requireAdmin()`/`requireAppUser()` itself and (for non-admin-only aggregates) applies center-scoping internally so an AU POC can never see data outside their assigned Centers, even by mistake in a new route. Route handlers/server actions must never query `readers`/`payments`/`attendance`/etc. directly — always through `lib/data`. This is enforced by convention, not the type system — when adding a new aggregate, grep `app/` for `from(<table>)` outside `lib/data` before merging, and spot-check that every new exported `lib/data` function actually calls `requireAdmin`/`requireAppUser` (a past audit did this by scripting a regex check per function — see git history on the "reports/export/polish" commit for the approach).
  - **One deliberate exception:** `getPaymentIntentByTxnId`/`markPaymentIntentResult` in `lib/data/payments.ts` call neither — they back `app/pay/*` and the PayU webhook, which by nature have no logged-in session. The random `txnId` is the bearer credential instead (same trust model as a password-reset link). Don't add a lookup here keyed on a bare id without going through `txnId`.

**Deleting master-data rows:** every `deleteX` in `lib/data/master-data.ts`/`lib/data/coupons.ts` attempts the delete and catches a Postgres FK-violation into a friendly error, rather than pre-checking dependents — no `onDelete` cascade exists anywhere in the schema, so the DB already enforces "can't delete something still referenced." **Gotcha:** the thrown error's `.code` is *not* on the top-level error — Drizzle wraps the real driver error in `DrizzleQueryError`, whose `.cause` holds the actual Postgres error with `.code === "23503"`. Check both (`isForeignKeyViolation()` in `master-data.ts` does). Deleting a POC/Admin also calls `auth.admin.removeUser({ userId })` (same Better Auth admin plugin as `createUser`) to drop their Neon Auth login — done *after* the DB delete succeeds, so a blocked delete never leaves an orphaned auth account.

**Postgres gotcha: `LIKE` doesn't work on `date` columns.** `sql`${dateCol} like ${'2026-07' + '%'}`` throws `operator does not exist: date ~~ unknown` — this broke the dashboard KPI queries (`getDashboardKpis` in `lib/data/reports.ts`) and silently 500'd on every AU POC's post-login redirect until caught by Playwright testing. Use `gte`/`lt` date-range comparisons (`gte(col, monthStart)`, `lt(col, nextMonthStart)`) for "is this date in month X" checks, never string pattern matching.

**Verifying auth/mutation flows:** curl can't reliably test this app — CSRF Origin-header checks and Server Action encoding make false negatives common (cost us real debugging time). Use Playwright instead: `npm install -D playwright && npx playwright install chromium` (no `--with-deps`; sudo isn't available in this sandbox, but the plain Chromium download works fine without it). Drive it with a real `chromium.launch({ args: ["--no-sandbox"] })` + `page.fill`/`page.click` against the dev server, not `fetch`/`curl` with manually-copied cookies.

**Database (Neon Postgres + Drizzle):** `lib/db/schema.ts` is the full schema (all tables, already pushed). `lib/db/index.ts` exports the `db` instance — uses `@neondatabase/serverless`'s **Pool** (WebSocket, via the `ws` package) and `drizzle-orm/neon-serverless`, not `neon-http`, because billing/payment/coupon writes need real `db.transaction()`.

- `readers.outstanding_balance` is a maintained running total, but every change to it must go through `lib/billing/ledger.ts: postLedgerEntry()` in the same transaction as an insert into `reader_billing_ledger` — never mutate the balance column directly anywhere else. Ledger amounts are a signed delta (charges positive, payments/discounts negative), so `SUM(ledger.amount) == outstanding_balance` per reader is always a valid invariant — check it with `npm run db:reconcile-ledger`. `lib/data/billing.ts` is the orchestration layer (fetches attendance + pricing, calls the pure `lib/billing/calculate.ts`, then `postLedgerEntry()`); `closeMonth()` there is idempotent per `(reader, billing_period)`, safe to re-trigger.
- `city_pricing` is a history table (`city_id, price, effective_from`) — a city's price changes over time, and past months must bill at whatever price was active then. Never add a single "current price" column.

**Billing formula (confirmed, see plan for full rationale):** `daily_rate = price_effective_that_day / days_in_month`; monthly charge = sum of `daily_rate` over days marked `delivered`. Unmarked days count as delivered at month-close. Month-close is an admin-triggered action (no cron dependency for v1), not automatic.

**shadcn is on the Base UI variant, not Radix** (`components.json` `base: "base"`) — composing a non-button element (e.g. a `Link`) via a component's `render` prop needs `nativeButton={false}` on `Button`, or Base UI logs a console warning about missing native button semantics. Check `rules/base-vs-radix.md` in the shadcn skill before using `asChild`-style patterns from memory — this codebase uses `render`, not `asChild`.

**Theme:** Red/white/black, set entirely via CSS custom properties in `app/globals.css` (`--primary`, `--destructive`, etc.) — `--destructive` is intentionally a different red (darker/desaturated) from `--primary` so error/delete states stay visually distinct from primary actions. Don't hardcode colors elsewhere; everything should consume the CSS variables via Tailwind's semantic classes.

**PayU payment gateway (`lib/payu/`, `app/pay/*`, `app/api/payu/webhook`):** `PAYU_KEY`/`PAYU_SALT` in `.env.local` are **production** credentials (no sandbox mode) — every entry point that could create a real chargeable link is gated behind `PAYU_GATEWAY_ENABLED` (`lib/payu/config.ts`), which defaults to off. Don't flip it or add a way to flip it from the UI; it's meant to require a deliberate env-var edit + restart by a human who's about to test a real transaction. `lib/payu/hash.ts`'s forward/reverse hash templates are PayU's fixed protocol spec — if you ever touch them, diff the resulting template literal against `lib/payu/hash.ts`'s own comment (or the old au-ui source) character-for-character; the pipe count is easy to get subtly wrong by hand and a wrong hash fails silently on PayU's side.

**Public, unauthenticated routes:** `/pay*` and `/api/invoice/*` are the only pages a signed-out person can load — a reader clicking a payment/invoice link from SMS has no session. `proxy.ts` explicitly exempts these two path prefixes from the auth redirect (in addition to its existing GET/HEAD-only gating and the static-asset extension exemption). If you add another public route, it needs the same treatment there, and its data access needs the same `txnId`-as-bearer-token pattern described above — never scope a public route by a bare internal id.

**Live SMS (`lib/sms/send-reminder.ts`):** wired to VISPL's bulk SMS API using `SMS_API_USERNAME`/`SMS_API_PASSWORD`. The two message templates (`reminder`, `payment_link`) are DLT-registered with this business's SMS account — Indian carriers scrub outgoing messages against the literal registered text, so don't reword them. There's no third template for "payment received, here's your invoice" (the old app never actually had one either, despite superficially wiring it — that path was always a stub); the PayU webhook logs the invoice link instead of texting it, until a template gets registered for that message.

## Environment

`.env.local` (gitignored) needs `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEXT_PUBLIC_NEON_AUTH_URL`, `NEON_AUTH_COOKIE_SECRET` (min 32 chars — generate with `openssl rand -base64 32`), `PAYU_KEY`/`PAYU_SALT`/`PAYU_GATEWAY_ENABLED` (default `false`), `SMS_API_USERNAME`/`SMS_API_PASSWORD`. See `.env.example` for the shape. Neon project: `dashboard-erik` (org `amarujala`).
