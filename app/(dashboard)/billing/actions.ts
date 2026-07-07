"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { closeMonth } from "@/lib/data/billing";

export type CloseMonthState = { message: string } | { error: string } | null;

export async function closeMonthAction(
  _prev: CloseMonthState,
  formData: FormData
): Promise<CloseMonthState> {
  const billingPeriod = z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Invalid billing period (expected YYYY-MM)")
    .parse(formData.get("billingPeriod"));

  try {
    const result = await closeMonth(billingPeriod);
    revalidatePath("/billing");
    const skipped =
      result.skippedAlreadyClosedCount > 0 ? ` (${result.skippedAlreadyClosedCount} already closed, skipped)` : "";
    return { message: `Closed ${result.billingPeriod}: charged ${result.chargedCount} reader(s)${skipped}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to close month." };
  }
}
