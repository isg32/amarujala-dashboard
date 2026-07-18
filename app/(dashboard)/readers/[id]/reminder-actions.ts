"use server";

import { z } from "zod";
import { requireAppUser } from "@/lib/auth/session";
import { getReader } from "@/lib/data/readers";
import { getAmountDue, getCurrentMonthProvisional } from "@/lib/data/billing";
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
  // Current month's unbilled provisional charge (for the {amount} tag)
  // plus the full total (for the {total} tag) — the SMS template says
  // "Month {month} Bill due {amount} and Total due {total}" so they
  // need to be different when a previous balance exists.
  const [provisional, amountDue] = await Promise.all([
    getCurrentMonthProvisional(id),
    getAmountDue(id),
  ]);
  const result = await sendPaymentReminder(
    { ...reader, outstandingBalance: amountDue.toFixed(2) },
    { currentMonthCharge: provisional.amount.toFixed(2), totalDue: amountDue.toFixed(2) }
  );
  return result.success ? { message: "Reminder sent." } : { error: `SMS failed to send: ${result.error}` };
}
