"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { readerInputSchema, readerEditSchema } from "@/lib/validation/reader";
import {
  createReader,
  bulkDeleteReaders,
  updateReaderBillingAnchor,
  updateReader,
  bulkTransferReaders,
  bulkUpdateReaderStatus,
  bulkUpdateReaderLandmark,
  searchReadersForPicker,
} from "@/lib/data/readers";

export type CreateReaderState = { error: string } | null;

export async function createReaderAction(_prev: CreateReaderState, formData: FormData): Promise<CreateReaderState> {
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

  let id: number;
  try {
    ({ id } = await createReader(input));
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to add reader." };
  }
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

export async function updateReaderAction(readerId: number, formData: FormData): Promise<{ error: string } | void> {
  const input = readerEditSchema.parse({
    name: formData.get("name") ?? "",
    mobile: formData.get("mobile") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    landmark: formData.get("landmark") ?? "",
    subscriptionStartDate: formData.get("subscriptionStartDate") ?? "",
    status: formData.get("status") ?? "active",
  });
  try {
    await updateReader(readerId, input);
    revalidatePath(`/readers/${readerId}`);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update reader." };
  }
}

export async function bulkTransferReadersAction(readerIds: number[], toCenterId: number): Promise<{ message: string }> {
  const { transferred } = await bulkTransferReaders(readerIds, toCenterId);
  revalidatePath("/readers");
  const skipped = readerIds.length - transferred;
  return { message: `Transferred ${transferred} reader(s)${skipped ? `, ${skipped} already at that Center` : ""}.` };
}

export async function bulkUpdateReaderStatusAction(readerIds: number[], status: "active" | "inactive"): Promise<{ message: string }> {
  const { updated } = await bulkUpdateReaderStatus(readerIds, status);
  revalidatePath("/readers");
  return { message: `Marked ${updated} reader(s) as ${status}.` };
}

export async function bulkUpdateReaderLandmarkAction(readerIds: number[], landmark: string): Promise<{ message: string }> {
  const { updated } = await bulkUpdateReaderLandmark(readerIds, landmark);
  revalidatePath("/readers");
  return { message: `Updated landmark for ${updated} reader(s).` };
}

export type ReaderSearchResult = {
  id: number;
  name: string;
  readerCode: string;
  mobile: string;
  centerName: string;
  cityName: string;
};

export async function searchReadersAction(query: string): Promise<ReaderSearchResult[]> {
  const rows = await searchReadersForPicker(query);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    readerCode: r.readerCode,
    mobile: r.mobile,
    centerName: r.centerName,
    cityName: r.cityName,
  }));
}
