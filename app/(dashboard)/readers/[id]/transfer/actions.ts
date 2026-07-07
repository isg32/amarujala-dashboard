"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { transferReader } from "@/lib/data/readers";

export async function transferReaderAction(formData: FormData) {
  const readerId = z.coerce.number().int().positive().parse(formData.get("readerId"));
  const toCenterId = z.coerce.number().int().positive().parse(formData.get("toCenterId"));
  const remarks = z.string().trim().optional().parse(formData.get("remarks") || undefined);

  await transferReader(readerId, toCenterId, remarks);
  redirect(`/readers/${readerId}`);
}
