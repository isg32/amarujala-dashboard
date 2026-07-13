"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth/session";
import { recordPayment, reversePayment, createPaymentLink, markPaymentIntentFailed } from "@/lib/data/payments";
import { getReader } from "@/lib/data/readers";
import { sendPaymentLinkSms, previewPaymentLinkMessage, isoToDMY } from "@/lib/sms/send-reminder";

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

export type SendPaymentLinkOptions = {
  voucherCouponId?: number;
  amountOverride?: number;
  /** 'YYYY-MM-DD'; defaults to the current calendar month. */
  startDate?: string;
  /** 'YYYY-MM-DD'; defaults to the current calendar month. */
  endDate?: string;
  /** Sends the real SMS to this number instead of the reader's own — for
   * verifying the message on a real phone without texting an actual customer. */
  testMobile?: string;
};

export type GeneratedPaymentLink = { txnId: string; payUrl: string; amount: string; message: string };

// Splits "create the real link" from "send it" so an admin can see the
// exact SMS text — with the real, working /pay URL and the real final
// amount (after any voucher/override) — before actually spending an SMS
// credit or texting a customer. This creates a genuine payment_intents row
// (requires PAYU_GATEWAY_ENABLED) since there's no such thing as a "real
// preview link" that isn't real; the diagnostics page's Test SMS is the
// one that gets away with a fake placeholder link instead.
export async function generatePaymentLinkAction(
  readerId: number,
  options: SendPaymentLinkOptions = {}
): Promise<{ error: string } | GeneratedPaymentLink> {
  try {
    const { txnId, reader, amount } = await createPaymentLink(readerId, {
      voucherCouponId: options.voucherCouponId,
      amountOverride: options.amountOverride,
    });
    const origin = (await headers()).get("origin") ?? `https://${(await headers()).get("host")}`;
    const payUrl = `${origin}/pay?id=${txnId}`;
    const message = await previewPaymentLinkMessage(reader, payUrl, {
      startDate: options.startDate ? isoToDMY(options.startDate) : undefined,
      endDate: options.endDate ? isoToDMY(options.endDate) : undefined,
      amount,
    });
    revalidatePath(`/readers/${readerId}`);
    return { txnId, payUrl, amount, message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to generate payment link." };
  }
}

// Sends the SMS for a link generatePaymentLinkAction already created —
// no new payment_intent, just the message for the given txnId/amount, so
// what gets sent is guaranteed to match what was just reviewed.
export async function sendGeneratedPaymentLinkSmsAction(
  readerId: number,
  link: GeneratedPaymentLink,
  startDate?: string,
  endDate?: string,
  testMobile?: string
): Promise<{ error: string } | { message: string }> {
  await requireAdmin();
  try {
    const reader = await getReader(readerId);
    if (!reader) throw new Error("Reader not found.");
    const smsResult = await sendPaymentLinkSms(reader, link.payUrl, {
      startDate: startDate ? isoToDMY(startDate) : undefined,
      endDate: endDate ? isoToDMY(endDate) : undefined,
      testMobile,
      amount: link.amount,
    });
    if (!smsResult.success) return { error: `SMS failed to send: ${smsResult.error}` };
    return {
      message: testMobile ? `Test payment link sent by SMS to ${testMobile}.` : "Payment link sent by SMS.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to send payment link." };
  }
}

// Renders the exact SMS text without sending anything or touching PayU/the
// ledger — works even while PAYU_GATEWAY_ENABLED is off, using a placeholder
// link, so an admin can check the date range before spending real SMS credits.
export async function previewPaymentLinkMessageAction(
  readerId: number,
  startDate?: string,
  endDate?: string
): Promise<{ error: string } | { message: string }> {
  await requireAdmin();
  try {
    const reader = await getReader(readerId);
    if (!reader) throw new Error("Reader not found.");
    const origin = (await headers()).get("origin") ?? `https://${(await headers()).get("host")}`;
    const payUrl = `${origin}/pay?id=PREVIEW`;
    const message = await previewPaymentLinkMessage(reader, payUrl, {
      startDate: startDate ? isoToDMY(startDate) : undefined,
      endDate: endDate ? isoToDMY(endDate) : undefined,
    });
    return { message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to preview message." };
  }
}

export type BulkSendResult = {
  message: string;
  sent: number;
  failed: number;
  // One entry per reader that didn't go out, so an admin can see exactly
  // who was skipped/failed and why (not just a total count).
  failures: { readerId: number; readerName: string; reason: string }[];
};

// Bulk create-and-send, for the reader directory's checkbox-select
// toolbar — always atomic (no per-reader review step, unlike the single-
// reader generate/send flow above). Continues past individual failures (e.g. a
// reader with no balance due, or the SMS gateway rejecting one number) so
// one bad row doesn't block the rest — but every failure is still reported
// back by name and reason rather than silently counted.
export async function sendBulkPaymentLinksAction(readerIds: number[]): Promise<BulkSendResult> {
  const origin = (await headers()).get("origin") ?? `https://${(await headers()).get("host")}`;
  let sent = 0;
  const failures: BulkSendResult["failures"] = [];

  for (const readerId of readerIds) {
    try {
      const { txnId, reader, amount } = await createPaymentLink(readerId);
      const smsResult = await sendPaymentLinkSms(reader, `${origin}/pay?id=${txnId}`, { amount });
      if (smsResult.success) {
        sent++;
      } else {
        // The link/ledger side already succeeded here — only the SMS failed.
        failures.push({ readerId, readerName: reader.name, reason: `SMS failed: ${smsResult.error}` });
      }
    } catch (e) {
      const readerName = (await getReader(readerId).catch(() => null))?.name ?? `#${readerId}`;
      failures.push({
        readerId,
        readerName,
        reason: e instanceof Error ? e.message : "Failed to create payment link.",
      });
    }
  }

  return {
    sent,
    failed: failures.length,
    failures,
    message: `Sent ${sent} link(s)${failures.length ? `, ${failures.length} failed` : ""}.`,
  };
}

export async function reversePaymentAction(
  paymentId: number,
  reason?: string
): Promise<{ error: string } | undefined> {
  try {
    await reversePayment(paymentId, reason);
    revalidatePath("/payments");
    revalidatePath("/payments/history");
    revalidatePath("/readers", "layout");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reverse payment." };
  }
}

export async function markPaymentIntentFailedAction(intentId: number): Promise<{ error: string } | undefined> {
  try {
    await markPaymentIntentFailed(intentId);
    revalidatePath("/payments/history");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update payment link." };
  }
}
