"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { updateSmsTemplate, resetSmsTemplate } from "@/lib/data/sms-templates";
import type { SmsTemplateType } from "@/lib/sms/send-reminder";

const typeSchema = z.enum(["reminder", "payment_link", "payment_confirmation"]);

export async function updateSmsTemplateAction(formData: FormData): Promise<{ error: string } | void> {
  const type = typeSchema.parse(formData.get("type")) as SmsTemplateType;
  const template = z.string().trim().min(1, "Template can't be empty").parse(formData.get("template"));
  try {
    await updateSmsTemplate(type, template);
    revalidatePath("/master-data/sms-templates");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update template." };
  }
}

export async function resetSmsTemplateAction(type: SmsTemplateType): Promise<{ error: string } | void> {
  try {
    await resetSmsTemplate(type);
    revalidatePath("/master-data/sms-templates");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reset template." };
  }
}
