"use server";

import { z } from "zod";
import { requireAppUser } from "@/lib/auth/session";
import { getReader } from "@/lib/data/readers";
import { getAmountDue, getReaderMonthlyLedger } from "@/lib/data/billing";
import { sendPaymentReminder, type ReminderAmounts } from "@/lib/sms/send-reminder";

export async function sendPaymentReminderAction(
  readerId: number,
  billingPeriod?: string
): Promise<{ error: string } | { message: string }> {
  const user = await requireAppUser();
  if (user.suspended) {
    return { error: "Your account is suspended. Contact an Administrator." };
  }
  const id = z.coerce.number().int().positive().parse(readerId);
  const reader = await getReader(id);
  if (!reader) return { error: "Reader not found." };

  const amountDue = await getAmountDue(id);

  let amounts: ReminderAmounts = {
    currentMonthCharge: amountDue.toFixed(2),
    totalDue: amountDue.toFixed(2),
  };
  let periodLabel: string | undefined;

  // Optional: target the reminder at one specific billing month's balance
  // (for a reader who's several months behind). The month's owed figure is
  // recomputed here server-side — never trusted from the client.
  if (billingPeriod) {
    const period = z
      .string()
      .regex(/^\d{4}-\d{2}$/, "Invalid billing period")
      .parse(billingPeriod);
    const rows = await getReaderMonthlyLedger(id);
    const row = rows.find((r) => r.billingPeriod === period);
    if (!row) return { error: `No billing activity for ${period}.` };
    if (row.due <= 0) return { error: `Nothing outstanding for ${period}.` };

    // Bare month name only, to keep the {month} tag the exact shape the
    // DLT-registered template already carries ("September"). The admin-facing
    // confirmation below still names the year.
    const monthName = new Date(`${period}-01T00:00:00Z`).toLocaleString("en-US", {
      month: "long",
      timeZone: "UTC",
    });
    periodLabel = `${monthName} ${period.slice(0, 4)}`;
    amounts = {
      currentMonthCharge: row.due.toFixed(2),
      totalDue: amountDue.toFixed(2),
      monthLabel: monthName,
    };
  }

  const result = await sendPaymentReminder(
    { ...reader, outstandingBalance: amountDue.toFixed(2) },
    amounts
  );
  if (!result.success) return { error: `SMS failed to send: ${result.error}` };
  return { message: periodLabel ? `Reminder sent for ${periodLabel}.` : "Reminder sent." };
}
