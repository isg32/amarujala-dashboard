"use server";

import { z } from "zod";
import { getReader } from "@/lib/data/readers";
import { sendPaymentReminder } from "@/lib/sms/send-reminder";

export async function sendPaymentReminderAction(formData: FormData) {
  const readerId = z.coerce.number().int().positive().parse(formData.get("readerId"));
  const reader = await getReader(readerId);
  if (!reader) throw new Error("Reader not found.");
  await sendPaymentReminder(reader);
}
