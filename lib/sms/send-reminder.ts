import "server-only";

// Live VISPL bulk SMS integration, ported from the old app
// (src/routes/app-api/sms/+server.ts). SENDER_ID/ENTITY_ID/contentIds and
// the exact template text are DLT-registered with this business's SMS
// account — Indian telecom carriers scrub messages against the literally
// registered text, so these must not be reworded.
const VISPL_API_URL = "https://bulksmsapi.vispl.in/";
const SENDER_ID = "AMARED";
const ENTITY_ID = "1701158080315505109";

const TEMPLATES = {
  reminder: {
    contentId: "1707177821506648204",
    formatMessage: (v: Record<string, string>) =>
      `REMINDER! ${v.name} Month ${v.month} Bill due ${v.amount} and Total due ${v.total} Due by ${v.dueDate} - AMAR UJALA`,
  },
  payment_link: {
    contentId: "1707178281136561332",
    // ponytail: the old template's registered text hardcodes the old app's
    // own domain in the URL. We don't know whether the DLT registration
    // treats the domain as fixed text or a variable slot, so this passes
    // through whatever payUrl the caller builds (this app's own origin)
    // rather than guessing — if delivery fails due to a DLT text mismatch,
    // the fix is re-registering the template with VISPL, not a code change.
    formatMessage: (v: Record<string, string>) =>
      `${v.name}, your bill of Rs.${v.amount} for ${v.startDate} to ${v.endDate} is due. Pay: ${v.payUrl} - Amar Ujala`,
  },
} as const;

async function sendSms(phoneNumber: string, templateType: keyof typeof TEMPLATES, variables: Record<string, string>) {
  const { SMS_API_USERNAME, SMS_API_PASSWORD } = process.env;
  if (!SMS_API_USERNAME || !SMS_API_PASSWORD) {
    console.error("[SMS] SMS_API_USERNAME/SMS_API_PASSWORD not configured — skipping send.");
    return;
  }

  const template = TEMPLATES[templateType];
  const message = template.formatMessage(variables);

  const params = new URLSearchParams({
    username: SMS_API_USERNAME,
    password: SMS_API_PASSWORD,
    messageType: "text",
    mobile: phoneNumber.replace(/\D/g, ""),
    senderId: SENDER_ID,
    ContentID: template.contentId,
    EntityID: ENTITY_ID,
    template_id: template.contentId,
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
    }
  } catch (err) {
    console.error(`[SMS] Failed to send "${templateType}" to ${phoneNumber}:`, err);
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

type ReminderReader = { name: string; mobile: string; outstandingBalance: string };

export async function sendPaymentReminder(reader: ReminderReader) {
  const now = new Date();
  const amount = reader.outstandingBalance;
  await sendSms(reader.mobile, "reminder", {
    name: reader.name,
    month: now.toLocaleString("en-US", { month: "long", timeZone: "UTC" }),
    amount,
    total: amount,
    dueDate: endOfMonth(now),
  });
}

export async function sendPaymentLinkSms(reader: ReminderReader, payUrl: string) {
  const now = new Date();
  await sendSms(reader.mobile, "payment_link", {
    name: reader.name,
    amount: reader.outstandingBalance,
    startDate: startOfMonth(now),
    endDate: endOfMonth(now),
    payUrl,
  });
}
