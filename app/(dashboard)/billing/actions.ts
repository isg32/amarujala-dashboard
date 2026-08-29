"use server";

import { revalidatePath } from "next/cache";
import { closeSubscription } from "@/lib/data/billing";

export async function closeSubscriptionAction(readerId: number, writeOffPendingAsAdjustment?: boolean): Promise<{ error: string } | { message: string }> {
  try {
    const result = await closeSubscription(readerId, { writeOffPendingAsAdjustment });
    revalidatePath(`/readers/${readerId}`);
    revalidatePath("/billing");
    revalidatePath("/readers");
    if (result.writtenOffAsAdjustment) {
      return { message: `Subscription closed (${result.billingPeriod}): pending ₹${result.amount.toFixed(2)} written off as adjustment.` };
    }
    return { message: `Subscription closed (${result.billingPeriod}): final charge ₹${result.amount.toFixed(2)}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to close subscription." };
  }
}
