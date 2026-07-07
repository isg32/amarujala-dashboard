"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { recordPayment } from "@/lib/data/payments";

const methodSchema = z.enum(["cash", "upi", "bank_transfer", "razorpay", "other"]);

export type RecordPaymentState = { message: string } | { error: string } | null;

export async function recordPaymentAction(
  _prev: RecordPaymentState,
  formData: FormData
): Promise<RecordPaymentState> {
  const readerId = z.coerce.number().int().positive().parse(formData.get("readerId"));
  const amount = z.coerce.number().positive().parse(formData.get("amount"));
  const method = methodSchema.parse(formData.get("method"));
  const methodOtherLabel = z.string().trim().optional().parse(formData.get("methodOtherLabel") || undefined);
  const transactionReference = z.string().trim().optional().parse(formData.get("transactionReference") || undefined);
  const remarks = z.string().trim().optional().parse(formData.get("remarks") || undefined);
  const paymentDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
    .parse(formData.get("paymentDate"));

  try {
    await recordPayment({ readerId, amount, method, methodOtherLabel, transactionReference, remarks, paymentDate });
    revalidatePath(`/readers/${readerId}`);
    revalidatePath("/payments");
    return { message: `Recorded payment of ₹${amount.toFixed(2)}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to record payment." };
  }
}
