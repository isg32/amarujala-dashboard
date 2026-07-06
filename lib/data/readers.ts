import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import { requireAppUser, type AppUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { readers, centers, cities, units, zones, appUsers, pocCenters } from "@/lib/db/schema";
import type { ReaderInput } from "@/lib/validation/reader";

export type ReaderFilters = {
  search?: string;
  status?: "active" | "inactive";
  newlyAdded?: boolean;
  zoneId?: number;
  unitId?: number;
  cityId?: number;
  centerId?: number;
};

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

export async function listReaders(filters: ReaderFilters = {}) {
  const user = await requireAppUser();

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

  return baseReaderQuery()
    .where(and(...conditions.filter((c) => c !== undefined)))
    .orderBy(desc(readers.createdAt));
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
    .select({ id: centers.id, name: centers.name, cityName: cities.name })
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

export async function createReader(input: ReaderInput) {
  const user = await requireAppUser();

  if (user.role === "au_poc" && !user.centerIds.includes(input.centerId)) {
    throw new Error("You cannot add a reader to a Center outside your assignment.");
  }

  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(readers)
      .values({
        name: input.name,
        mobile: input.mobile,
        email: input.email,
        address: input.address,
        landmark: input.landmark,
        centerId: input.centerId,
        assignedPocId: input.assignedPocId,
        subscriptionStartDate: input.subscriptionStartDate,
        remarks: input.remarks,
        readerCode: "", // placeholder, replaced below once we have the id
        createdBy: user.id,
      })
      .returning({ id: readers.id });

    const readerCode = `RDR-${String(inserted.id).padStart(6, "0")}`;
    await tx.update(readers).set({ readerCode }).where(eq(readers.id, inserted.id));

    return { id: inserted.id, readerCode };
  });
}
