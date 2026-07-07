import "server-only";
import { randomBytes } from "crypto";
import { asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import {
  zones,
  units,
  cities,
  centers,
  cityPricing,
  appUsers,
  pocCenters,
} from "@/lib/db/schema";

// No onDelete cascade exists anywhere in the schema (every FK is default
// RESTRICT), so a delete of a row something else still points at throws
// Postgres error code 23503. We catch that and rethrow a friendly message
// instead of letting it surface as a raw DB error.
function isForeignKeyViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === "23503" || e.cause?.code === "23503";
}

export async function listZones() {
  await requireAdmin();
  return db.select().from(zones).orderBy(asc(zones.name));
}

export async function createZone(name: string) {
  await requireAdmin();
  await db.insert(zones).values({ name });
}

export async function deleteZone(id: number) {
  await requireAdmin();
  try {
    await db.delete(zones).where(eq(zones.id, id));
  } catch (err) {
    if (isForeignKeyViolation(err)) throw new Error("Cannot delete — this zone still has units under it.");
    throw err;
  }
}

export async function listUnits() {
  await requireAdmin();
  return db
    .select({ id: units.id, name: units.name, zoneId: units.zoneId, zoneName: zones.name })
    .from(units)
    .innerJoin(zones, eq(units.zoneId, zones.id))
    .orderBy(asc(units.name));
}

export async function createUnit(zoneId: number, name: string) {
  await requireAdmin();
  await db.insert(units).values({ zoneId, name });
}

export async function deleteUnit(id: number) {
  await requireAdmin();
  try {
    await db.delete(units).where(eq(units.id, id));
  } catch (err) {
    if (isForeignKeyViolation(err)) throw new Error("Cannot delete — this unit still has cities under it.");
    throw err;
  }
}

export async function listCities() {
  await requireAdmin();
  return db
    .select({ id: cities.id, name: cities.name, unitId: cities.unitId, unitName: units.name })
    .from(cities)
    .innerJoin(units, eq(cities.unitId, units.id))
    .orderBy(asc(cities.name));
}

export async function createCity(unitId: number, name: string) {
  await requireAdmin();
  await db.insert(cities).values({ unitId, name });
}

export async function deleteCity(id: number) {
  await requireAdmin();
  try {
    // Pricing history is only meaningful alongside the city itself, and
    // nothing else references city_pricing rows, so it's safe to clear
    // before removing the city. Centers are not touched — those block the
    // delete below if any still exist.
    await db.delete(cityPricing).where(eq(cityPricing.cityId, id));
    await db.delete(cities).where(eq(cities.id, id));
  } catch (err) {
    if (isForeignKeyViolation(err)) throw new Error("Cannot delete — this city still has centers under it.");
    throw err;
  }
}

export async function listCenters() {
  await requireAdmin();
  return db
    .select({
      id: centers.id,
      name: centers.name,
      address: centers.address,
      cityId: centers.cityId,
      cityName: cities.name,
    })
    .from(centers)
    .innerJoin(cities, eq(centers.cityId, cities.id))
    .orderBy(asc(centers.name));
}

export async function createCenter(cityId: number, name: string, address?: string) {
  await requireAdmin();
  await db.insert(centers).values({ cityId, name, address });
}

export async function deleteCenter(id: number) {
  await requireAdmin();
  try {
    // POC↔Center assignments are just mappings, not audit history — clear
    // them before removing the center. Readers still block the delete below.
    await db.delete(pocCenters).where(eq(pocCenters.centerId, id));
    await db.delete(centers).where(eq(centers.id, id));
  } catch (err) {
    if (isForeignKeyViolation(err)) throw new Error("Cannot delete — this center still has readers assigned to it.");
    throw err;
  }
}

export async function listCityPricing() {
  await requireAdmin();
  return db
    .select({
      id: cityPricing.id,
      cityId: cityPricing.cityId,
      cityName: cities.name,
      price: cityPricing.price,
      effectiveFrom: cityPricing.effectiveFrom,
    })
    .from(cityPricing)
    .innerJoin(cities, eq(cityPricing.cityId, cities.id))
    .orderBy(asc(cities.name), asc(cityPricing.effectiveFrom));
}

export async function setCityPrice(cityId: number, price: string, effectiveFrom: string) {
  await requireAdmin();
  await db.insert(cityPricing).values({ cityId, price, effectiveFrom });
}

export async function deleteCityPricing(id: number) {
  await requireAdmin();
  await db.delete(cityPricing).where(eq(cityPricing.id, id));
}

export async function listPocs() {
  await requireAdmin();
  const pocs = await db
    .select({ id: appUsers.id, name: appUsers.name, email: appUsers.email })
    .from(appUsers)
    .where(eq(appUsers.role, "au_poc"))
    .orderBy(asc(appUsers.name));

  const assignments = await db
    .select({
      pocUserId: pocCenters.pocUserId,
      centerId: pocCenters.centerId,
      centerName: centers.name,
    })
    .from(pocCenters)
    .innerJoin(centers, eq(pocCenters.centerId, centers.id));

  return pocs.map((poc) => ({
    ...poc,
    centers: assignments.filter((a) => a.pocUserId === poc.id).map((a) => ({ id: a.centerId, name: a.centerName })),
  }));
}

// Shared by createPoc/createAdmin: creates the Neon Auth login (requires the
// caller to already hold Neon Auth's own admin role — see CLAUDE.md for the
// one-time bootstrap this depends on). If the caller supplies a password it's
// used directly and no temp password is returned; otherwise one is
// generated and must be relayed to the new user.
async function createAppUserLogin(name: string, email: string, password?: string) {
  const tempPassword = password ? undefined : randomBytes(9).toString("base64url");
  const { data, error } = await auth.admin.createUser({ email, name, password: password ?? tempPassword! });
  if (error || !data?.user) {
    throw new Error(error?.message ?? "Failed to create login");
  }
  return { id: data.user.id, tempPassword };
}

export async function createPoc(input: { name: string; email: string; centerIds: number[]; password?: string }) {
  await requireAdmin();

  const { id, tempPassword } = await createAppUserLogin(input.name, input.email, input.password);
  await db.insert(appUsers).values({ id, name: input.name, email: input.email, role: "au_poc" });
  if (input.centerIds.length > 0) {
    await db.insert(pocCenters).values(input.centerIds.map((centerId) => ({ pocUserId: id, centerId })));
  }

  return { id, tempPassword };
}

export async function deletePoc(id: string) {
  await requireAdmin();
  try {
    await db.delete(pocCenters).where(eq(pocCenters.pocUserId, id));
    await db.delete(appUsers).where(eq(appUsers.id, id));
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new Error("Cannot delete — this POC has recorded activity (readers, payments, attendance) that must stay for audit history.");
    }
    throw err;
  }
  await auth.admin.removeUser({ userId: id });
}

export async function listAdmins() {
  await requireAdmin();
  return db
    .select({ id: appUsers.id, name: appUsers.name, email: appUsers.email })
    .from(appUsers)
    .where(eq(appUsers.role, "admin"))
    .orderBy(asc(appUsers.name));
}

// Any existing Administrator can create another — same Neon Auth admin-role
// requirement as createPoc, no centers involved since admins aren't
// center-scoped.
export async function createAdmin(input: { name: string; email: string; password?: string }) {
  await requireAdmin();

  const { id, tempPassword } = await createAppUserLogin(input.name, input.email, input.password);
  await db.insert(appUsers).values({ id, name: input.name, email: input.email, role: "admin" });

  return { id, tempPassword };
}

export async function deleteAdmin(id: string) {
  const currentUser = await requireAdmin();
  if (currentUser.id === id) {
    throw new Error("You cannot delete your own account while signed in as it.");
  }
  try {
    await db.delete(appUsers).where(eq(appUsers.id, id));
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw new Error("Cannot delete — this administrator has recorded activity that must stay for audit history.");
    }
    throw err;
  }
  await auth.admin.removeUser({ userId: id });
}
