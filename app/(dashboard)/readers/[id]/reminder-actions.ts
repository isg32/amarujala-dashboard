"use server";

import { z } from "zod";
import { requireAppUser } from "@/lib/auth/session";
import { getReader } from "@/lib/data/readers";
import { getAmountDue } from "@/lib/data/billing";
import { sendPaymentReminder } from "@/lib/sms/send-reminder";

export async function sendPaymentReminderAction(
  readerId: number
): Promise<{ error: string } | { message: string }> {
  const user = await requireAppUser();
  if (user.suspended) {
    return { error: "Your account is suspended. Contact an Administrator." };
  }
  const id = z.coerce.number().int().positive().parse(readerId);
  const reader = await getReader(id);
  if (!reader) return { error: "Reader not found." };
  // Live amount due, not the stale posted-only balance — billing no longer
  // requires a periodic Close Month to reflect what's actually accrued.
  const amountDue = await getAmountDue(id);
  const result = await sendPaymentReminder({ ...reader, outstandingBalance: amountDue.toFixed(2) });
  return result.success ? { message: "Reminder sent." } : { error: `SMS failed to send: ${result.error}` };
}
