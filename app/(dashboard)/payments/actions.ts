"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { recordPayment, reversePayment, createPaymentLink } from "@/lib/data/payments";
import { sendPaymentLinkSms } from "@/lib/sms/send-reminder";

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

// Admin-only (createPaymentLink enforces this via requireAdmin). Generates
// the PayU link and sends it to the reader by SMS in one step. An optional
// voucher (existing coupon) discounts the balance first — see
// createPaymentLink's own comment for why all the failure checks (gateway
// disabled, voucher too large, etc.) happen before the voucher is applied.
export async function sendPaymentLinkAction(
  readerId: number,
  voucherCouponId?: number
): Promise<{ error: string } | { message: string }> {
  try {
    const { txnId, reader } = await createPaymentLink(readerId, voucherCouponId);
    const origin = (await headers()).get("origin") ?? `https://${(await headers()).get("host")}`;
    const payUrl = `${origin}/pay?id=${txnId}`;
    await sendPaymentLinkSms(reader, payUrl);
    revalidatePath(`/readers/${readerId}`);
    return { message: "Payment link sent by SMS." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to send payment link." };
  }
}

// Bulk variant of sendPaymentLinkAction, for the reader directory's
// checkbox-select toolbar. Continues past individual failures (e.g. a
// reader with no balance due) so one bad row doesn't block the rest.
export async function sendBulkPaymentLinksAction(readerIds: number[]): Promise<{ message: string }> {
  const origin = (await headers()).get("origin") ?? `https://${(await headers()).get("host")}`;
  let sent = 0;
  let failed = 0;
  for (const readerId of readerIds) {
    try {
      const { txnId, reader } = await createPaymentLink(readerId);
      await sendPaymentLinkSms(reader, `${origin}/pay?id=${txnId}`);
      sent++;
    } catch {
      failed++;
    }
  }
  return { message: `Sent ${sent} link(s)${failed ? `, ${failed} skipped (e.g. no balance due)` : ""}.` };
}

export async function reversePaymentAction(
  paymentId: number,
  reason?: string
): Promise<{ error: string } | undefined> {
  try {
    await reversePayment(paymentId, reason);
    revalidatePath("/payments");
    revalidatePath("/readers", "layout");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reverse payment." };
  }
}
