import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { smsTemplates } from "@/lib/db/schema";

// Live VISPL bulk SMS integration, ported from the old app
// (src/routes/app-api/sms/+server.ts). SENDER_ID/ENTITY_ID/contentIds are
// fixed (tied to the DLT registration's ContentID, not the wording) and
// never change. The template TEXT below is editable by an admin (see
// lib/data/sms-templates.ts) — but Indian carriers scrub outgoing messages
// against the literally DLT-registered text, so an edited template will
// simply fail to deliver unless the business also updates the matching DLT
// registration with VISPL to the new wording. DEFAULT_TEMPLATES holds the
// text actually registered today (confirmed 2026-07-10 against VISPL's own
// template dump for payment_link, and a real sent-message example for
// reminder) — editing is a deliberate, informed choice, not a default.
const VISPL_API_URL = "https://bulksmsapi.vispl.in/";
const SENDER_ID = "AMARED";
const ENTITY_ID = "1701158080315505109";

const TEMPLATE_META = {
  reminder: { contentId: "1707177821506648204" },
  payment_link: { contentId: "1707178281136561332" },
} as const;

export type SmsTemplateType = keyof typeof TEMPLATE_META;

// {tag} placeholders — the set of tags per type must stay exactly this set
// (see lib/data/sms-templates.ts's updateSmsTemplate validation) since each
// one corresponds to a positionally DLT-registered {#var#} slot of a fixed
// type (alphanumeric/number/url). Wording and order around them can change;
// the tags themselves can't be added, removed, or renamed.
export const DEFAULT_TEMPLATES: Record<SmsTemplateType, string> = {
  reminder: "REMINDER! {name} Month {month} Bill due {amount} and Total due {total} Due by {dueDate} - AMAR UJALA",
  payment_link: "{name}, your bill of Rs.{amount} for {startDate} to {endDate} is due. Pay: {payUrl} - Amar Ujala",
};

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

async function getTemplateText(type: SmsTemplateType): Promise<string> {
  const [row] = await db.select().from(smsTemplates).where(eq(smsTemplates.type, type));
  return row?.template ?? DEFAULT_TEMPLATES[type];
}

export type SendSmsResult = { success: true } | { success: false; error: string };

// Returns whether VISPL's API actually accepted the message (HTTP ok + no
// "error"/"fail" in its response body) — this is "accepted by the gateway",
// not a carrier-side delivery receipt (VISPL's API doesn't give us one; the
// old app never had this signal either). Good enough to tell an admin a send
// genuinely failed rather than silently vanishing into a console log.
async function sendSms(
  phoneNumber: string,
  templateType: SmsTemplateType,
  variables: Record<string, string>
): Promise<SendSmsResult> {
  const { SMS_API_USERNAME, SMS_API_PASSWORD } = process.env;
  if (!SMS_API_USERNAME || !SMS_API_PASSWORD) {
    const error = "SMS_API_USERNAME/SMS_API_PASSWORD not configured.";
    console.error(`[SMS] ${error} — skipping send.`);
    return { success: false, error };
  }

  const templateText = await getTemplateText(templateType);
  const message = renderTemplate(templateText, variables);
  const contentId = TEMPLATE_META[templateType].contentId;

  const params = new URLSearchParams({
    username: SMS_API_USERNAME,
    password: SMS_API_PASSWORD,
    messageType: "text",
    mobile: phoneNumber.replace(/\D/g, ""),
    senderId: SENDER_ID,
    ContentID: contentId,
    EntityID: ENTITY_ID,
    template_id: contentId,
    pe_id: ENTITY_ID,
    message,
  });
  // Indian SMS providers' DLT scrubber expects literal spaces, not '+'.
  const queryString = params.toString().replace(/\+/g, "%20");
  const requestUrl = `${VISPL_API_URL}?${queryString}`;

  try {
    const response = await fetch(requestUrl);
    const resultText = await response.text();
    const isProviderError = /error|fail/i.test(resultText);
    if (!response.ok || isProviderError) {
      console.error(`[SMS] Provider error sending "${templateType}" to ${phoneNumber}:`, resultText);
      return { success: false, error: resultText.slice(0, 300) || `HTTP ${response.status}` };
    }
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Network error";
    console.error(`[SMS] Failed to send "${templateType}" to ${phoneNumber}:`, err);
    return { success: false, error };
  }
}

function endOfMonth(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return formatDMY(d);
}

function startOfMonth(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  return formatDMY(d);
}

function formatDMY(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${d.getUTCFullYear()}`;
}

// Converts a plain 'YYYY-MM-DD' (what an <input type="date"> gives you) to
// the 'DD-MM-YYYY' format the DLT-registered template's date variables use.
export function isoToDMY(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
}

type ReminderReader = { name: string; mobile: string; outstandingBalance: string };

export interface ReminderAmounts {
  /** Current month's unbilled provisional charge — goes into the {amount} tag. */
  currentMonthCharge: string;
  /** Total amount due (outstanding + current month) — goes into the {total} tag. */
  totalDue: string;
}

export interface PaymentLinkDateOverride {
  /** 'DD-MM-YYYY'; defaults to the 1st of the current month. */
  startDate?: string;
  /** 'DD-MM-YYYY'; defaults to the last day of the current month. */
  endDate?: string;
}

export interface PaymentLinkAmountOverride {
  /** The real link amount (from createPaymentLink's return value) — always
   * pass this once a real payment_intent exists, since it can differ from
   * reader.outstandingBalance (a voucher discount or manual override can
   * make the actual link amount different from the reader's raw balance). */
  amount?: string;
}

// Shared by the real send and the preview below so the two can never drift
// apart.
function buildPaymentLinkVariables(
  reader: ReminderReader,
  payUrl: string,
  opts?: PaymentLinkDateOverride & PaymentLinkAmountOverride
) {
  const now = new Date();
  return {
    name: reader.name,
    amount: opts?.amount ?? reader.outstandingBalance,
    startDate: opts?.startDate || startOfMonth(now),
    endDate: opts?.endDate || endOfMonth(now),
    payUrl,
  };
}

// Renders the exact text sendPaymentLinkSms would send, without sending
// anything — lets an admin check the date range, link, and template wording
// before a real SMS (and real SMS-provider cost) goes out.
export async function previewPaymentLinkMessage(
  reader: ReminderReader,
  payUrl: string,
  opts?: PaymentLinkDateOverride & PaymentLinkAmountOverride
) {
  const templateText = await getTemplateText("payment_link");
  return renderTemplate(templateText, buildPaymentLinkVariables(reader, payUrl, opts));
}

export async function sendPaymentReminder(
  reader: ReminderReader,
  amounts?: ReminderAmounts
): Promise<SendSmsResult> {
  const now = new Date();
  return sendSms(reader.mobile, "reminder", {
    name: reader.name,
    month: now.toLocaleString("en-US", { month: "long", timeZone: "UTC" }),
    amount: amounts?.currentMonthCharge ?? reader.outstandingBalance,
    total: amounts?.totalDue ?? reader.outstandingBalance,
    dueDate: endOfMonth(now),
  });
}

// `testMobile` sends the real message to a different number than the
// reader's own (e.g. the admin's own phone) — a way to verify formatting and
// delivery for real without texting an actual customer.
export async function sendPaymentLinkSms(
  reader: ReminderReader,
  payUrl: string,
  options?: PaymentLinkDateOverride & PaymentLinkAmountOverride & { testMobile?: string }
): Promise<SendSmsResult> {
  const variables = buildPaymentLinkVariables(reader, payUrl, options);
  return sendSms(options?.testMobile || reader.mobile, "payment_link", variables);
}

// Diagnostics page support: preview/send for a made-up test customer,
// covering both templates, not tied to any real reader. Goes through the
// exact same getTemplateText/renderTemplate/sendSms path as every real
// send, so a pass here is a real signal the pipeline works — not a
// simulation of it.
export async function previewTestMessage(type: SmsTemplateType, variables: Record<string, string>): Promise<string> {
  const templateText = await getTemplateText(type);
  return renderTemplate(templateText, variables);
}

export async function sendTestSms(
  type: SmsTemplateType,
  mobile: string,
  variables: Record<string, string>
): Promise<SendSmsResult> {
  return sendSms(mobile, type, variables);
}
