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
  pricingOverrides,
  appUsers,
  pocCenters,
  pocPermissions,
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

export async function updateZone(id: number, name: string) {
  await requireAdmin();
  await db.update(zones).set({ name }).where(eq(zones.id, id));
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

export async function updateUnit(id: number, zoneId: number, name: string) {
  await requireAdmin();
  await db.update(units).set({ zoneId, name }).where(eq(units.id, id));
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

export async function updateCity(id: number, unitId: number, name: string) {
  await requireAdmin();
  await db.update(cities).set({ unitId, name }).where(eq(cities.id, id));
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

export async function updateCenter(id: number, cityId: number, name: string, address?: string) {
  await requireAdmin();
  await db.update(centers).set({ cityId, name, address }).where(eq(centers.id, id));
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

export async function updateCityPricing(id: number, price: string, effectiveFrom: string) {
  await requireAdmin();
  await db.update(cityPricing).set({ price, effectiveFrom }).where(eq(cityPricing.id, id));
}

export async function deleteCityPricing(id: number) {
  await requireAdmin();
  await db.delete(cityPricing).where(eq(cityPricing.id, id));
}

// "Day Rates": flat per-day overrides layered on top of city_pricing, at
// Unit/Center/Global scope — see lib/db/schema.ts's pricingOverrides for
// the full rationale and lib/billing/calculate.ts's resolveDailyRate() for
// how these are applied during billing.
export async function listPricingOverrides() {
  await requireAdmin();
  const [overrides, unitRows, centerRows] = await Promise.all([
    db.select().from(pricingOverrides).orderBy(asc(pricingOverrides.scope)),
    db.select({ id: units.id, name: units.name }).from(units),
    db.select({ id: centers.id, name: centers.name }).from(centers),
  ]);
  const unitNames = new Map(unitRows.map((u) => [u.id, u.name]));
  const centerNames = new Map(centerRows.map((c) => [c.id, c.name]));

  return overrides.map((o) => ({
    ...o,
    scopeLabel:
      o.scope === "global"
        ? "Global"
        : o.scope === "unit"
          ? (unitNames.get(o.scopeId!) ?? "Unknown unit")
          : (centerNames.get(o.scopeId!) ?? "Unknown center"),
  }));
}

export async function createPricingOverride(input: {
  scope: "global" | "unit" | "center";
  scopeId: number | null;
  dailyPrice: string;
  /** 'YYYY-MM-DD', optional — set for a one-day-only hike (e.g. a festival)
   * instead of an ongoing Day Rate. */
  forDate?: string;
}) {
  const user = await requireAdmin();
  if (input.scope !== "global" && input.scopeId == null) {
    throw new Error("A Unit or Center override needs a scope selected.");
  }
  await db.insert(pricingOverrides).values({
    scope: input.scope,
    scopeId: input.scope === "global" ? null : input.scopeId,
    dailyPrice: input.dailyPrice,
    forDate: input.forDate,
    createdBy: user.id,
  });
}

export async function updatePricingOverride(id: number, input: { dailyPrice: string; active: boolean }) {
  await requireAdmin();
  await db
    .update(pricingOverrides)
    .set({ dailyPrice: input.dailyPrice, active: input.active })
    .where(eq(pricingOverrides.id, id));
}

export async function deletePricingOverride(id: number) {
  await requireAdmin();
  await db.delete(pricingOverrides).where(eq(pricingOverrides.id, id));
}

export async function listPocs() {
  await requireAdmin();
  const pocs = await db
    .select({ id: appUsers.id, name: appUsers.name, email: appUsers.email, suspended: appUsers.suspended })
    .from(appUsers)
    .where(eq(appUsers.role, "au_poc"))
    .orderBy(asc(appUsers.name));

  const [assignments, permissionRows] = await Promise.all([
    db
      .select({
        pocUserId: pocCenters.pocUserId,
        centerId: pocCenters.centerId,
        centerName: centers.name,
      })
      .from(pocCenters)
      .innerJoin(centers, eq(pocCenters.centerId, centers.id)),
    db.select().from(pocPermissions),
  ]);
  const permissionsByPoc = new Map(permissionRows.map((p) => [p.pocUserId, p]));

  return pocs.map((poc) => ({
    ...poc,
    centers: assignments.filter((a) => a.pocUserId === poc.id).map((a) => ({ id: a.centerId, name: a.centerName })),
    // Missing row = full access, same default as lib/auth/session.ts.
    canRecordPayments: permissionsByPoc.get(poc.id)?.canRecordPayments ?? true,
    canMarkAttendance: permissionsByPoc.get(poc.id)?.canMarkAttendance ?? true,
    canAddReaders: permissionsByPoc.get(poc.id)?.canAddReaders ?? true,
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

// Name and assigned Centers are editable in place — this covers "an
// executive left, reassign their Centers" without needing to delete and
// recreate the POC (which would break their login history / any records
// keyed to that Neon Auth id). Email is deliberately NOT editable here: it's
// the actual Neon Auth login identifier, and changing app_users.email alone
// would desync it from the real account — a genuine email change needs a
// dedicated Neon Auth admin call we haven't wired up, not just a DB update.
export async function updatePoc(
  id: string,
  input: {
    name: string;
    centerIds: number[];
    password?: string;
    canRecordPayments: boolean;
    canMarkAttendance: boolean;
    canAddReaders: boolean;
    suspended: boolean;
  }
) {
  await requireAdmin();
  await db.update(appUsers).set({ name: input.name, suspended: input.suspended }).where(eq(appUsers.id, id));
  await db.delete(pocCenters).where(eq(pocCenters.pocUserId, id));
  if (input.centerIds.length > 0) {
    await db.insert(pocCenters).values(input.centerIds.map((centerId) => ({ pocUserId: id, centerId })));
  }
  await db
    .insert(pocPermissions)
    .values({
      pocUserId: id,
      canRecordPayments: input.canRecordPayments,
      canMarkAttendance: input.canMarkAttendance,
      canAddReaders: input.canAddReaders,
    })
    .onConflictDoUpdate({
      target: pocPermissions.pocUserId,
      set: {
        canRecordPayments: input.canRecordPayments,
        canMarkAttendance: input.canMarkAttendance,
        canAddReaders: input.canAddReaders,
      },
    });
  if (input.password) {
    await auth.admin.setUserPassword({ userId: id, newPassword: input.password });
  }
}

export async function deletePoc(id: string) {
  await requireAdmin();
  try {
    await db.delete(pocCenters).where(eq(pocCenters.pocUserId, id));
    await db.delete(pocPermissions).where(eq(pocPermissions.pocUserId, id));
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

export async function updateAdmin(id: string, name: string) {
  await requireAdmin();
  await db.update(appUsers).set({ name }).where(eq(appUsers.id, id));
}

// Grants the target admin the same Neon Auth internal admin role the calling
// admin holds (see CLAUDE.md's bootstrap section) — required for THAT admin's
// own session to later call auth.admin.createUser/removeUser/setRole (e.g. to
// create POCs or promote further admins). Better Auth's admin plugin itself
// enforces that the caller must already hold this role, so an admin who
// doesn't have it yet will get a clean error here rather than silently no-op.
export async function grantNeonAuthAdminRole(id: string) {
  await requireAdmin();
  const { error } = await auth.admin.setRole({ userId: id, role: "admin" });
  if (error) {
    throw new Error(error.message ?? "Failed to grant admin access — your own account may not hold this permission yet.");
  }
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
