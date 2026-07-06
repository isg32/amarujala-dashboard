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
- `proxy.ts` — mounts `auth.middleware({ loginUrl: "/auth/sign-in" })`, matches everything except `_next/static`, `_next/image`, `favicon.ico`. Confirmed it doesn't loop on `/auth/sign-in` or block `/api/auth/*`.
- `lib/auth/client.ts` — `authClient` for client components (`authClient.useSession()`).
- `app/auth-provider.tsx` + `app/auth/[path]/page.tsx` — pre-built Neon Auth UI (sign-in/up/reset/etc via `AuthView`).

**Data access — the scoping chokepoint (not yet built, see task list):** `lib/data/*.ts` (one file per aggregate: readers, attendance, payments, coupons, master-data, reports) will be the *only* place those tables are queried from. Every function takes the resolved app user first and applies center-scoping internally so an AU POC can never see data outside their assigned Centers, even by mistake in a new route. Route handlers/server actions must never query `readers`/`payments`/`attendance` directly — always through `lib/data`.

**Database (Neon Postgres + Drizzle):** `lib/db/schema.ts` is the full schema (all tables, already pushed). `lib/db/index.ts` exports the `db` instance — uses `@neondatabase/serverless`'s **Pool** (WebSocket, via the `ws` package) and `drizzle-orm/neon-serverless`, not `neon-http`, because billing/payment/coupon writes need real `db.transaction()`.

- `readers.outstanding_balance` is a maintained running total, but every change to it must go through `lib/billing/ledger.ts: postLedgerEntry()` (not yet built) in the same transaction as an insert into `reader_billing_ledger` — never mutate the balance column directly anywhere else. This is what makes the balance auditable/reconcilable.
- `city_pricing` is a history table (`city_id, price, effective_from`) — a city's price changes over time, and past months must bill at whatever price was active then. Never add a single "current price" column.

**Billing formula (confirmed, see plan for full rationale):** `daily_rate = price_effective_that_day / days_in_month`; monthly charge = sum of `daily_rate` over days marked `delivered`. Unmarked days count as delivered at month-close. Month-close is an admin-triggered action (no cron dependency for v1), not automatic.

**Theme:** Red/white/black, set entirely via CSS custom properties in `app/globals.css` (`--primary`, `--destructive`, etc.) — `--destructive` is intentionally a different red (darker/desaturated) from `--primary` so error/delete states stay visually distinct from primary actions. Don't hardcode colors elsewhere; everything should consume the CSS variables via Tailwind's semantic classes.

## Environment

`.env.local` (gitignored) needs `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `NEXT_PUBLIC_NEON_AUTH_URL`, `NEON_AUTH_COOKIE_SECRET` (min 32 chars — generate with `openssl rand -base64 32`). See `.env.example` for the shape. Neon project: `dashboard-erik` (org `amarujala`).
