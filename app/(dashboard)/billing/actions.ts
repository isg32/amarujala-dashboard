"use server";

import { revalidatePath } from "next/cache";
import { closeSubscription } from "@/lib/data/billing";

export async function closeSubscriptionAction(
  readerId: number,
  adjustment?: { amount: number; reason: string }
): Promise<{ error: string } | { message: string }> {
  try {
    const result = await closeSubscription(readerId, adjustment ? { adjustment } : undefined);
    revalidatePath(`/readers/${readerId}`);
    revalidatePath("/billing");
    revalidatePath("/readers");
    let message = `Subscription closed (${result.billingPeriod}): final charge ₹${result.amount.toFixed(2)}.`;
    if (result.adjustmentAmount != null) {
      const abs = Math.abs(result.adjustmentAmount).toFixed(2);
      const kind = result.adjustmentAmount < 0 ? "credit" : "charge";
      message += ` Adjustment ₹${abs} (${kind}) also posted.`;
    }
    return { message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to close subscription." };
  }
}
