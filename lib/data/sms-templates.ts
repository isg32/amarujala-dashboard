import "server-only";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { smsTemplates } from "@/lib/db/schema";
import { DEFAULT_TEMPLATES, type SmsTemplateType } from "@/lib/sms/send-reminder";

function extractTags(template: string): Set<string> {
  return new Set([...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
}

export async function listSmsTemplates() {
  await requireAdmin();
  const rows = await db.select().from(smsTemplates);
  const byType = new Map(rows.map((r) => [r.type, r]));

  return (Object.keys(DEFAULT_TEMPLATES) as SmsTemplateType[]).map((type) => {
    const row = byType.get(type);
    return {
      type,
      template: row?.template ?? DEFAULT_TEMPLATES[type],
      defaultTemplate: DEFAULT_TEMPLATES[type],
      isCustomized: row != null,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

// The set of {tag} placeholders must exactly match the default template's —
// each one is a positionally DLT-registered {#var#} slot of a fixed type
// (alphanumeric/number/url); adding, removing, or renaming one will silently
// break delivery (the carrier's scrubber won't match the registered text).
// Wording and ordering around the tags is otherwise free to edit.
export async function updateSmsTemplate(type: SmsTemplateType, template: string) {
  const user = await requireAdmin();

  const requiredTags = extractTags(DEFAULT_TEMPLATES[type]);
  const givenTags = extractTags(template);
  const missing = [...requiredTags].filter((t) => !givenTags.has(t));
  const extra = [...givenTags].filter((t) => !requiredTags.has(t));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `This template must use exactly these placeholders: ${[...requiredTags].map((t) => `{${t}}`).join(", ")}.` +
        (missing.length ? ` Missing: ${missing.map((t) => `{${t}}`).join(", ")}.` : "") +
        (extra.length ? ` Unknown: ${extra.map((t) => `{${t}}`).join(", ")}.` : "")
    );
  }

  await db
    .insert(smsTemplates)
    .values({ type, template, updatedBy: user.id })
    .onConflictDoUpdate({
      target: smsTemplates.type,
      set: { template, updatedAt: new Date(), updatedBy: user.id },
    });
}

export async function resetSmsTemplate(type: SmsTemplateType) {
  await requireAdmin();
  await db.delete(smsTemplates).where(eq(smsTemplates.type, type));
}
