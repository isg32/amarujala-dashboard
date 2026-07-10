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

// Admin-only (createPaymentLink enforces this via requireAdmin). Generates
// the PayU link and sends it to the reader (or, in test mode, to
// testMobile) by SMS in one step. An optional voucher (existing coupon)
// discounts the balance first, and/or the admin can directly override the
// final amount — see createPaymentLink's own comment for how the two
// interact and why the failure checks (gateway disabled, voucher too large,
// etc.) happen before the voucher is applied. The message's fixed wording is
// DLT-registered and never changes; only its date-range and link variables do.
export async function sendPaymentLinkAction(
  readerId: number,
  options: SendPaymentLinkOptions = {}
): Promise<{ error: string } | { message: string }> {
  try {
    const { txnId, reader } = await createPaymentLink(readerId, {
      voucherCouponId: options.voucherCouponId,
      amountOverride: options.amountOverride,
    });
    const origin = (await headers()).get("origin") ?? `https://${(await headers()).get("host")}`;
    const payUrl = `${origin}/pay?id=${txnId}`;
    const smsResult = await sendPaymentLinkSms(reader, payUrl, {
      startDate: options.startDate ? isoToDMY(options.startDate) : undefined,
      endDate: options.endDate ? isoToDMY(options.endDate) : undefined,
      testMobile: options.testMobile,
    });
    revalidatePath(`/readers/${readerId}`);
    if (!smsResult.success) {
      // The link itself was created successfully (payment_intent + any
      // voucher already committed) — only the SMS failed, so say so
      // precisely rather than implying the whole action failed.
      return { error: `Link created, but SMS failed to send: ${smsResult.error}. Share it manually: ${payUrl}` };
    }
    return {
      message: options.testMobile
        ? `Test payment link sent by SMS to ${options.testMobile}.`
        : "Payment link sent by SMS.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to send payment link." };
  }
}

// Test mode: sends a REAL SMS (real provider cost) but to an admin-chosen
// number instead of the reader's own, and — unlike sendPaymentLinkAction —
// never touches createPaymentLink/PayU or the ledger, so it works whether or
// not PAYU_GATEWAY_ENABLED is on. The link in the message is a placeholder,
// not a real payable one.
export async function sendTestPaymentLinkSmsAction(
  readerId: number,
  testMobile: string,
  startDate?: string,
  endDate?: string
): Promise<{ error: string } | { message: string }> {
  await requireAdmin();
  try {
    const reader = await getReader(readerId);
    if (!reader) throw new Error("Reader not found.");
    const origin = (await headers()).get("origin") ?? `https://${(await headers()).get("host")}`;
    const smsResult = await sendPaymentLinkSms(reader, `${origin}/pay?id=TEST`, {
      startDate: startDate ? isoToDMY(startDate) : undefined,
      endDate: endDate ? isoToDMY(endDate) : undefined,
      testMobile,
    });
    if (!smsResult.success) {
      return { error: `SMS failed to send: ${smsResult.error}` };
    }
    return { message: `Test SMS sent to ${testMobile}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to send test SMS." };
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

// Bulk variant of sendPaymentLinkAction, for the reader directory's
// checkbox-select toolbar. Continues past individual failures (e.g. a
// reader with no balance due, or the SMS gateway rejecting one number) so
// one bad row doesn't block the rest — but every failure is still reported
// back by name and reason rather than silently counted.
export async function sendBulkPaymentLinksAction(readerIds: number[]): Promise<BulkSendResult> {
  const origin = (await headers()).get("origin") ?? `https://${(await headers()).get("host")}`;
  let sent = 0;
  const failures: BulkSendResult["failures"] = [];

  for (const readerId of readerIds) {
    try {
      const { txnId, reader } = await createPaymentLink(readerId);
      const smsResult = await sendPaymentLinkSms(reader, `${origin}/pay?id=${txnId}`);
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
