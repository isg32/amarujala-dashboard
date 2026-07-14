import "server-only";
import { alias } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, gt, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { requireAdmin, requireAppUser, type AppUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { readers, centers, cities, units, zones, appUsers, pocCenters, readerTransfers } from "@/lib/db/schema";
import type { ReaderInput } from "@/lib/validation/reader";
import type { ParsedReaderRow } from "@/lib/bulk-upload/parse-readers";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ReaderFilters = {
  search?: string;
  status?: "active" | "inactive";
  newlyAdded?: boolean;
  zoneId?: number;
  unitId?: number;
  cityId?: number;
  centerId?: number;
  landmark?: string;
  dueOnly?: boolean;
};

// Shared by every lib/data/*.ts module that needs to check a specific
// Center against the caller's assignment (attendance, billing, ...).
export function assertCenterInScope(user: AppUser, centerId: number) {
  if (user.role === "au_poc" && !user.centerIds.includes(centerId)) {
    throw new Error("This is outside your assigned Centers.");
  }
}

// Every reader query goes through this scoping helper: admins see everything,
// AU POCs are restricted to their assigned Centers. Never query `readers`
// directly from a route/action — always through this file.
function scopeToCenters(user: AppUser) {
  if (user.role === "admin") return undefined;
  if (user.centerIds.length === 0) return sql`false`;
  return inArray(readers.centerId, user.centerIds);
}

const readerListSelection = {
  id: readers.id,
  readerCode: readers.readerCode,
  name: readers.name,
  mobile: readers.mobile,
  email: readers.email,
  address: readers.address,
  landmark: readers.landmark,
  remarks: readers.remarks,
  status: readers.status,
  subscriptionStartDate: readers.subscriptionStartDate,
  billingAnchorDay: readers.billingAnchorDay,
  outstandingBalance: readers.outstandingBalance,
  createdAt: readers.createdAt,
  centerId: readers.centerId,
  centerName: centers.name,
  cityName: cities.name,
  pocName: appUsers.name,
};

function baseReaderQuery() {
  return db
    .select(readerListSelection)
    .from(readers)
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .innerJoin(units, eq(cities.unitId, units.id))
    .innerJoin(zones, eq(units.zoneId, zones.id))
    .leftJoin(appUsers, eq(readers.assignedPocId, appUsers.id));
}

// Same FROM/JOIN chain as baseReaderQuery, just counting instead of
// selecting rows — kept as its own small function (rather than a generic
// wrapper) since Drizzle's chained builder types don't generalize well.
function readerCountQuery() {
  return db
    .select({ total: sql<number>`count(*)::int` })
    .from(readers)
    .innerJoin(centers, eq(readers.centerId, centers.id))
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .innerJoin(units, eq(cities.unitId, units.id))
    .innerJoin(zones, eq(units.zoneId, zones.id))
    .leftJoin(appUsers, eq(readers.assignedPocId, appUsers.id));
}

function buildReaderConditions(user: AppUser, filters: ReaderFilters) {
  const conditions = [scopeToCenters(user)];
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(readers.name, term),
        ilike(readers.mobile, term),
        ilike(readers.email, term),
        ilike(readers.readerCode, term)
      )
    );
  }
  if (filters.status) conditions.push(eq(readers.status, filters.status));
  if (filters.newlyAdded) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    conditions.push(gte(readers.createdAt, thirtyDaysAgo));
  }
  if (filters.centerId) conditions.push(eq(readers.centerId, filters.centerId));
  if (filters.cityId) conditions.push(eq(centers.cityId, filters.cityId));
  if (filters.unitId) conditions.push(eq(cities.unitId, filters.unitId));
  if (filters.zoneId) conditions.push(eq(units.zoneId, filters.zoneId));
  if (filters.landmark) conditions.push(ilike(readers.landmark, `%${filters.landmark}%`));
  if (filters.dueOnly) conditions.push(gt(readers.outstandingBalance, "0"));
  return and(...conditions.filter((c) => c !== undefined));
}

// Unpaginated — for exports and reports, which need every matching row, not
// one page. Don't use this for a picker UI — see searchReadersForPicker().
export async function listReaders(filters: ReaderFilters = {}) {
  const user = await requireAppUser();
  return baseReaderQuery().where(buildReaderConditions(user, filters)).orderBy(desc(readers.createdAt));
}

// Backs search-as-you-type reader pickers (attendance page) — capped, so it
// stays cheap regardless of org size, unlike shipping every reader to the
// client the way the picker used to.
export async function searchReadersForPicker(search: string, limit = 20) {
  const user = await requireAppUser();
  if (!search.trim()) return [];
  const where = buildReaderConditions(user, { search });
  return baseReaderQuery().where(where).orderBy(desc(readers.createdAt)).limit(limit);
}

// For the reader directory table: one page of rows plus the total count of
// every reader matching the same filters (so the on-screen count and
// pagination controls always agree with what's actually being shown).
export async function listReadersPaginated(filters: ReaderFilters = {}, page = 1, pageSize = 50) {
  const user = await requireAppUser();
  const where = buildReaderConditions(user, filters);

  const [rows, [{ total }]] = await Promise.all([
    baseReaderQuery().where(where).orderBy(desc(readers.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
    readerCountQuery().where(where),
  ]);

  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getReader(id: number) {
  const user = await requireAppUser();
  const scope = scopeToCenters(user);
  const conditions = [eq(readers.id, id)];
  if (scope) conditions.push(scope);

  const [reader] = await baseReaderQuery().where(and(...conditions));
  return reader ?? null;
}

// Centers (and the POCs assigned to each) the current user is allowed to
// pick from on the "New Reader" form — admins get every Center, AU POCs only
// their own assignments.
export async function listAssignableCentersWithPocs() {
  const user = await requireAppUser();
  const centerScope = user.role === "admin" ? undefined : inArray(centers.id, user.centerIds);

  const centerRows = await db
    .select({ id: centers.id, name: centers.name, cityName: cities.name, unitId: cities.unitId })
    .from(centers)
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .where(centerScope)
    .orderBy(asc(centers.name));

  const centerIds = centerRows.map((c) => c.id);
  const pocRows =
    centerIds.length > 0
      ? await db
          .select({ centerId: pocCenters.centerId, pocId: appUsers.id, pocName: appUsers.name })
          .from(pocCenters)
          .innerJoin(appUsers, eq(pocCenters.pocUserId, appUsers.id))
          .where(inArray(pocCenters.centerId, centerIds))
      : [];

  return centerRows.map((c) => ({
    ...c,
    pocs: pocRows.filter((p) => p.centerId === c.id).map((p) => ({ id: p.pocId, name: p.pocName })),
  }));
}

// Shared by createReader and bulkCreateReaders — inserts one reader row and
// derives its reader_code from the assigned id (never free-text, never
// duplicated) in the same transaction.
async function insertReaderRow(
  tx: Tx,
  createdBy: string,
  input: {
    name: string;
    mobile: string;
    email?: string;
    address: string;
    landmark?: string;
    centerId: number;
    assignedPocId?: string;
    subscriptionStartDate: string;
    remarks?: string;
  }
) {
  const [inserted] = await tx
    .insert(readers)
    .values({ ...input, readerCode: "", createdBy })
    .returning({ id: readers.id });

  const readerCode = `RDR-${String(inserted.id).padStart(6, "0")}`;
  await tx.update(readers).set({ readerCode }).where(eq(readers.id, inserted.id));

  return { id: inserted.id, readerCode };
}

export async function createReader(input: ReaderInput) {
  const user = await requireAppUser();

  if (user.role === "au_poc") {
    if (!user.permissions.canAddReaders) {
      throw new Error("You don't have permission to add readers. Contact an Administrator.");
    }
    if (!user.centerIds.includes(input.centerId)) {
      throw new Error("You cannot add a reader to a Center outside your assignment.");
    }
  }

  return db.transaction((tx) => insertReaderRow(tx, user.id, input));
}

export type BulkCreateResult = {
  insertedCount: number;
  errors: { row: number; reason: string }[];
};

// Validates and inserts a batch of parsed spreadsheet rows. City/Center are
// resolved by name against listAssignableCentersWithPocs() — which is
// already center-scoped, so an AU POC referencing a Center outside their
// assignment naturally fails to resolve rather than needing a separate check.
// Invalid rows are reported, not silently dropped; valid rows are inserted
// in one transaction.
export async function bulkCreateReaders(parsedRows: ParsedReaderRow[]): Promise<BulkCreateResult> {
  const user = await requireAppUser();
  if (user.role === "au_poc" && !user.permissions.canAddReaders) {
    throw new Error("You don't have permission to add readers. Contact an Administrator.");
  }
  const availableCenters = await listAssignableCentersWithPocs();

  const errors: { row: number; reason: string }[] = [];
  const candidates: { row: number; centerId: number; data: Extract<ParsedReaderRow, { data: unknown }>["data"] }[] = [];
  const seenMobiles = new Set<string>();

  for (const parsed of parsedRows) {
    if ("error" in parsed) {
      errors.push({ row: parsed.row, reason: parsed.error });
      continue;
    }
    const { data } = parsed;
    const center = availableCenters.find(
      (c) => c.name.toLowerCase() === data.center.toLowerCase() && c.cityName.toLowerCase() === data.city.toLowerCase()
    );
    if (!center) {
      errors.push({ row: parsed.row, reason: `City/Center "${data.city} / ${data.center}" not found or not assigned to you` });
      continue;
    }
    if (seenMobiles.has(data.mobile)) {
      errors.push({ row: parsed.row, reason: `Duplicate mobile number ${data.mobile} within this file` });
      continue;
    }
    seenMobiles.add(data.mobile);
    candidates.push({ row: parsed.row, centerId: center.id, data });
  }

  if (candidates.length > 0) {
    const existing = await db
      .select({ mobile: readers.mobile })
      .from(readers)
      .where(inArray(readers.mobile, candidates.map((c) => c.data.mobile)));
    const existingMobiles = new Set(existing.map((e) => e.mobile));

    for (const candidate of candidates.filter((c) => existingMobiles.has(c.data.mobile))) {
      errors.push({ row: candidate.row, reason: `Mobile number ${candidate.data.mobile} already exists` });
    }
  }
  const toInsert = candidates.filter((c) => !errors.some((e) => e.row === c.row));

  let insertedCount = 0;
  if (toInsert.length > 0) {
    await db.transaction(async (tx) => {
      for (const candidate of toInsert) {
        await insertReaderRow(tx, user.id, {
          name: candidate.data.name,
          mobile: candidate.data.mobile,
          email: candidate.data.email,
          address: candidate.data.address,
          landmark: candidate.data.landmark,
          centerId: candidate.centerId,
          subscriptionStartDate: candidate.data.subscriptionStartDate,
          remarks: candidate.data.remarks,
        });
        insertedCount++;
      }
    });
  }

  errors.sort((a, b) => a.row - b.row);
  return { insertedCount, errors };
}

// Admin-only per the FRD ("Administrators should be able to transfer the
// reader"). Updates readers.center_id and logs the move — all history keyed
// off reader_id (attendance/payments/coupons/ledger) is untouched, only the
// current operational assignment changes.
export async function transferReader(readerId: number, toCenterId: number, remarks?: string) {
  const user = await requireAdmin();

  const [reader] = await db.select({ centerId: readers.centerId }).from(readers).where(eq(readers.id, readerId));
  if (!reader) throw new Error("Reader not found.");
  if (reader.centerId === toCenterId) throw new Error("Reader is already assigned to this Center.");

  await db.transaction(async (tx) => {
    await tx.insert(readerTransfers).values({
      readerId,
      fromCenterId: reader.centerId,
      toCenterId,
      transferredBy: user.id,
      remarks,
    });
    await tx.update(readers).set({ centerId: toCenterId }).where(eq(readers.id, readerId));
  });
}

// Admin-only. anchorDay null reverts the reader to calendar-month billing;
// 2-28 sets a custom cycle (1 is disallowed since it's identical to the
// calendar-month default — see lib/billing/calculate.ts's getBillingCycle).
export async function updateReaderBillingAnchor(readerId: number, anchorDay: number | null) {
  await requireAdmin();
  await db.update(readers).set({ billingAnchorDay: anchorDay }).where(eq(readers.id, readerId));
}

export async function listTransfersForReader(readerId: number) {
  const user = await requireAppUser();
  const [reader] = await db.select({ centerId: readers.centerId }).from(readers).where(eq(readers.id, readerId));
  if (!reader) throw new Error("Reader not found.");
  assertCenterInScope(user, reader.centerId);

  const fromCenters = alias(centers, "from_centers");
  const toCenters = alias(centers, "to_centers");

  return db
    .select({
      id: readerTransfers.id,
      fromCenterName: fromCenters.name,
      toCenterName: toCenters.name,
      transferredAt: readerTransfers.transferredAt,
      remarks: readerTransfers.remarks,
    })
    .from(readerTransfers)
    .innerJoin(fromCenters, eq(readerTransfers.fromCenterId, fromCenters.id))
    .innerJoin(toCenters, eq(readerTransfers.toCenterId, toCenters.id))
    .where(eq(readerTransfers.readerId, readerId))
    .orderBy(desc(readerTransfers.transferredAt));
}

// Admin-only. A reader with any real history (attendance, payments, ledger
// entries, coupons, transfers) can't actually be deleted — the FK is
// default RESTRICT, same pattern as master-data deletes — so this is safe
// to expose broadly: it only ever succeeds for readers with zero activity.
export async function bulkDeleteReaders(readerIds: number[]): Promise<{ deleted: number; blocked: number }> {
  await requireAdmin();
  let deleted = 0;
  let blocked = 0;
  for (const id of readerIds) {
    try {
      await db.delete(readers).where(eq(readers.id, id));
      deleted++;
    } catch {
      blocked++;
    }
  }
  return { deleted, blocked };
}

// Admin-only. Editable fields for an existing reader — deliberately excludes
// centerId (goes through transferReader/bulkTransferReaders instead, so
// every Center change stays logged to reader_transfers) and subscription
// start date (billing-relevant, not a plain profile detail).
export async function updateReader(
  readerId: number,
  input: { name: string; mobile: string; email?: string; address: string; landmark?: string; status: "active" | "inactive" }
) {
  await requireAdmin();
  const [reader] = await db.select({ id: readers.id }).from(readers).where(eq(readers.id, readerId));
  if (!reader) throw new Error("Reader not found.");
  await db
    .update(readers)
    .set({
      name: input.name,
      mobile: input.mobile,
      email: input.email ?? null,
      address: input.address,
      landmark: input.landmark ?? null,
      status: input.status,
    })
    .where(eq(readers.id, readerId));
}

// Bulk equivalent of transferReader() — same reader_transfers audit log per
// reader, just looped inside one transaction. Readers already at toCenterId
// are silently skipped rather than erroring the whole batch.
export async function bulkTransferReaders(readerIds: number[], toCenterId: number, remarks?: string): Promise<{ transferred: number }> {
  const user = await requireAdmin();
  if (readerIds.length === 0) return { transferred: 0 };

  const rows = await db.select({ id: readers.id, centerId: readers.centerId }).from(readers).where(inArray(readers.id, readerIds));
  const toMove = rows.filter((r) => r.centerId !== toCenterId);

  await db.transaction(async (tx) => {
    for (const r of toMove) {
      await tx.insert(readerTransfers).values({ readerId: r.id, fromCenterId: r.centerId, toCenterId, transferredBy: user.id, remarks });
      await tx.update(readers).set({ centerId: toCenterId }).where(eq(readers.id, r.id));
    }
  });

  return { transferred: toMove.length };
}

export async function bulkUpdateReaderStatus(readerIds: number[], status: "active" | "inactive"): Promise<{ updated: number }> {
  await requireAdmin();
  if (readerIds.length === 0) return { updated: 0 };
  await db.update(readers).set({ status }).where(inArray(readers.id, readerIds));
  return { updated: readerIds.length };
}

// The one "other field" that's actually sensible to set to the same value in
// bulk (a shared delivery-route/area tag) — unlike name/mobile/email/address,
// which are inherently per-reader and would be a foot-gun to bulk-overwrite.
export async function bulkUpdateReaderLandmark(readerIds: number[], landmark: string): Promise<{ updated: number }> {
  await requireAdmin();
  if (readerIds.length === 0) return { updated: 0 };
  await db.update(readers).set({ landmark: landmark || null }).where(inArray(readers.id, readerIds));
  return { updated: readerIds.length };
}
