"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  createZone,
  createUnit,
  createCity,
  createCenter,
  setCityPrice,
  createPoc,
} from "@/lib/data/master-data";

const nameSchema = z.string().trim().min(1, "Name is required");

export async function createZoneAction(formData: FormData) {
  const name = nameSchema.parse(formData.get("name"));
  await createZone(name);
  revalidatePath("/master-data/zones");
}

export async function createUnitAction(formData: FormData) {
  const zoneId = z.coerce.number().int().parse(formData.get("zoneId"));
  const name = nameSchema.parse(formData.get("name"));
  await createUnit(zoneId, name);
  revalidatePath("/master-data/units");
}

export async function createCityAction(formData: FormData) {
  const unitId = z.coerce.number().int().parse(formData.get("unitId"));
  const name = nameSchema.parse(formData.get("name"));
  await createCity(unitId, name);
  revalidatePath("/master-data/cities");
}

export async function createCenterAction(formData: FormData) {
  const cityId = z.coerce.number().int().parse(formData.get("cityId"));
  const name = nameSchema.parse(formData.get("name"));
  const address = z.string().trim().optional().parse(formData.get("address") || undefined);
  await createCenter(cityId, name, address);
  revalidatePath("/master-data/centers");
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

export async function createPocAction(
  formData: FormData
): Promise<{ tempPassword: string } | { error: string }> {
  const name = nameSchema.parse(formData.get("name"));
  const email = z.email().parse(formData.get("email"));
  const centerIds = formData
    .getAll("centerIds")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n));

  try {
    const { tempPassword } = await createPoc({ name, email, centerIds });
    revalidatePath("/master-data/pocs");
    return { tempPassword };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create POC" };
  }
}
