"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { previewTestMessage, sendTestSms, type SmsTemplateType } from "@/lib/sms/send-reminder";

const typeSchema = z.enum(["reminder", "payment_link"]);
const variablesSchema = z.record(z.string(), z.string());

export async function previewTestMessageAction(
  type: string,
  variables: Record<string, string>
): Promise<{ error: string } | { message: string }> {
  await requireAdmin();
  try {
    const parsedType = typeSchema.parse(type) as SmsTemplateType;
    const parsedVars = variablesSchema.parse(variables);
    const message = await previewTestMessage(parsedType, parsedVars);
    return { message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to preview message." };
  }
}

export async function sendTestSmsAction(
  type: string,
  mobile: string,
  variables: Record<string, string>
): Promise<{ error: string } | { message: string }> {
  await requireAdmin();
  try {
    const parsedType = typeSchema.parse(type) as SmsTemplateType;
    const parsedMobile = z.string().trim().regex(/^\d{10}$/, "Mobile number must be 10 digits").parse(mobile);
    const parsedVars = variablesSchema.parse(variables);
    const result = await sendTestSms(parsedType, parsedMobile, parsedVars);
    return result.success ? { message: `Test SMS sent to ${parsedMobile}.` } : { error: `SMS failed to send: ${result.error}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to send test SMS." };
  }
}
