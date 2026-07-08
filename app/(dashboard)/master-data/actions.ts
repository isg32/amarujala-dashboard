"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  createZone,
  deleteZone,
  createUnit,
  deleteUnit,
  createCity,
  deleteCity,
  createCenter,
  deleteCenter,
  setCityPrice,
  deleteCityPricing,
  createPricingOverride,
  updatePricingOverride,
  deletePricingOverride,
  createPoc,
  deletePoc,
  createAdmin,
  deleteAdmin,
} from "@/lib/data/master-data";

const nameSchema = z.string().trim().min(1, "Name is required");

type ActionResult = { error: string } | void;

async function toActionResult(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete" };
  }
}

export async function createZoneAction(formData: FormData) {
  const name = nameSchema.parse(formData.get("name"));
  await createZone(name);
  revalidatePath("/master-data/zones");
}

export async function deleteZoneAction(id: number): Promise<ActionResult> {
  return toActionResult(async () => {
    await deleteZone(id);
    revalidatePath("/master-data/zones");
  });
}

export async function createUnitAction(formData: FormData) {
  const zoneId = z.coerce.number().int().parse(formData.get("zoneId"));
  const name = nameSchema.parse(formData.get("name"));
  await createUnit(zoneId, name);
  revalidatePath("/master-data/units");
}

export async function deleteUnitAction(id: number): Promise<ActionResult> {
  return toActionResult(async () => {
    await deleteUnit(id);
    revalidatePath("/master-data/units");
  });
}

export async function createCityAction(formData: FormData) {
  const unitId = z.coerce.number().int().parse(formData.get("unitId"));
  const name = nameSchema.parse(formData.get("name"));
  await createCity(unitId, name);
  revalidatePath("/master-data/cities");
}

export async function deleteCityAction(id: number): Promise<ActionResult> {
  return toActionResult(async () => {
    await deleteCity(id);
    revalidatePath("/master-data/cities");
  });
}

export async function createCenterAction(formData: FormData) {
  const cityId = z.coerce.number().int().parse(formData.get("cityId"));
  const name = nameSchema.parse(formData.get("name"));
  const address = z.string().trim().optional().parse(formData.get("address") || undefined);
  await createCenter(cityId, name, address);
  revalidatePath("/master-data/centers");
}

export async function deleteCenterAction(id: number): Promise<ActionResult> {
  return toActionResult(async () => {
    await deleteCenter(id);
    revalidatePath("/master-data/centers");
  });
}

export async function setCityPriceAction(formData: FormData) {
  const cityId = z.coerce.number().int().parse(formData.get("cityId"));
  const price = z.coerce.number().positive().parse(formData.get("price")).toFixed(2);
  const effectiveFrom = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .parse(formData.get("effectiveFrom"));
  await setCityPrice(cityId, price, effectiveFrom);
  revalidatePath("/master-data/pricing");
}

export async function deleteCityPricingAction(id: number): Promise<ActionResult> {
  return toActionResult(async () => {
    await deleteCityPricing(id);
    revalidatePath("/master-data/pricing");
  });
}

export async function createPricingOverrideAction(formData: FormData): Promise<ActionResult> {
  const scope = z.enum(["global", "unit", "center"]).parse(formData.get("scope"));
  const scopeId = scope === "global" ? null : z.coerce.number().int().positive().parse(formData.get("scopeId"));
  const dailyPrice = z.coerce.number().positive().parse(formData.get("dailyPrice")).toFixed(2);
  try {
    await createPricingOverride({ scope, scopeId, dailyPrice });
    revalidatePath("/master-data/pricing");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add price override" };
  }
}

export async function updatePricingOverrideAction(formData: FormData): Promise<ActionResult> {
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const dailyPrice = z.coerce.number().positive().parse(formData.get("dailyPrice")).toFixed(2);
  const active = formData.get("active") === "on";
  try {
    await updatePricingOverride(id, { dailyPrice, active });
    revalidatePath("/master-data/pricing");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update price override" };
  }
}

export async function deletePricingOverrideAction(id: number): Promise<ActionResult> {
  return toActionResult(async () => {
    await deletePricingOverride(id);
    revalidatePath("/master-data/pricing");
  });
}

const optionalPasswordSchema = z
  .string()
  .trim()
  .min(8, "Password must be at least 8 characters")
  .optional()
  .or(z.literal("").transform(() => undefined));

export async function createPocAction(
  formData: FormData
): Promise<{ tempPassword?: string } | { error: string }> {
  const name = nameSchema.parse(formData.get("name"));
  const email = z.email().parse(formData.get("email"));
  const password = optionalPasswordSchema.parse(formData.get("password") ?? "");
  const centerIds = formData
    .getAll("centerIds")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n));

  try {
    const { tempPassword } = await createPoc({ name, email, centerIds, password });
    revalidatePath("/master-data/pocs");
    return { tempPassword };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create POC" };
  }
}

export async function deletePocAction(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await deletePoc(id);
    revalidatePath("/master-data/pocs");
  });
}

export async function createAdminAction(
  formData: FormData
): Promise<{ tempPassword?: string } | { error: string }> {
  const name = nameSchema.parse(formData.get("name"));
  const email = z.email().parse(formData.get("email"));
  const password = optionalPasswordSchema.parse(formData.get("password") ?? "");

  try {
    const { tempPassword } = await createAdmin({ name, email, password });
    revalidatePath("/master-data/pocs");
    return { tempPassword };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create admin" };
  }
}

export async function deleteAdminAction(id: string): Promise<ActionResult> {
  return toActionResult(async () => {
    await deleteAdmin(id);
    revalidatePath("/master-data/pocs");
  });
}
