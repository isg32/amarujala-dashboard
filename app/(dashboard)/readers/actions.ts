"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { readerInputSchema } from "@/lib/validation/reader";
import { createReader, bulkDeleteReaders, updateReaderBillingAnchor } from "@/lib/data/readers";

export async function createReaderAction(formData: FormData) {
  const input = readerInputSchema.parse({
    name: formData.get("name") ?? "",
    mobile: formData.get("mobile") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    landmark: formData.get("landmark") ?? "",
    centerId: formData.get("centerId") ?? "",
    assignedPocId: formData.get("assignedPocId") ?? "",
    subscriptionStartDate: formData.get("subscriptionStartDate") ?? "",
    remarks: formData.get("remarks") ?? "",
  });

  const { id } = await createReader(input);
  redirect(`/readers/${id}`);
}

const anchorDaySchema = z.coerce.number().int().min(2).max(28).nullable();

export async function updateReaderBillingAnchorAction(
  readerId: number,
  formData: FormData
): Promise<{ error: string } | void> {
  const raw = formData.get("billingAnchorDay");
  const anchorDay = anchorDaySchema.parse(raw ? raw : null);
  try {
    await updateReaderBillingAnchor(readerId, anchorDay);
    revalidatePath(`/readers/${readerId}`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update billing cycle." };
  }
}

export async function bulkDeleteReadersAction(readerIds: number[]): Promise<{ message: string }> {
  const { deleted, blocked } = await bulkDeleteReaders(readerIds);
  revalidatePath("/readers");
  return {
    message: `Deleted ${deleted} reader(s)${blocked ? `, ${blocked} skipped (they have payment/attendance history)` : ""}.`,
  };
}
