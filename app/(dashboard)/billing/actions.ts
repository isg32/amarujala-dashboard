"use server";

import { revalidatePath } from "next/cache";
import { closeSubscription } from "@/lib/data/billing";

export async function closeSubscriptionAction(readerId: number): Promise<{ error: string } | { message: string }> {
  try {
    const result = await closeSubscription(readerId);
    revalidatePath(`/readers/${readerId}`);
    revalidatePath("/billing");
    revalidatePath("/readers");
    return { message: `Subscription closed (${result.billingPeriod}): final charge ₹${result.amount.toFixed(2)}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to close subscription." };
  }
}
