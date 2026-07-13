import { requireAdmin } from "@/lib/auth/session";
import { PAYU_GATEWAY_ENABLED, getPayuCredentials } from "@/lib/payu/config";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TestSmsForm } from "./test-sms-form";

function hasPayuCredentials() {
  try {
    getPayuCredentials();
    return true;
  } catch {
    return false;
  }
}

export default async function DiagnosticsPage() {
  await requireAdmin();
  const smsConfigured = Boolean(process.env.SMS_API_USERNAME && process.env.SMS_API_PASSWORD);
  const payuConfigured = hasPayuCredentials();

  return (
    <div className="flex flex-col gap-6 overflow-x-auto">
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>What&apos;s actually configured in this environment right now.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            SMS credentials:
            <Badge variant={smsConfigured ? "default" : "destructive"}>{smsConfigured ? "Configured" : "Missing"}</Badge>
          </div>
          <div className="flex items-center gap-2">
            PayU credentials:
            <Badge variant={payuConfigured ? "default" : "destructive"}>{payuConfigured ? "Configured" : "Missing"}</Badge>
          </div>
          <div className="flex items-center gap-2">
            PayU gateway:
            <Badge variant={PAYU_GATEWAY_ENABLED ? "default" : "outline"}>
              {PAYU_GATEWAY_ENABLED ? "Enabled (real charges possible)" : "Disabled"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test SMS</CardTitle>
          <CardDescription>
            Send a real reminder or payment-link message to any number, with made-up test data — no real reader
            involved. Useful for checking the template wording and delivery without texting an actual customer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TestSmsForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testing a real payment link</CardTitle>
          <CardDescription>
            The message above uses a placeholder link — it isn&apos;t a real payable one. To test an actual PayU
            transaction end to end, use &quot;Send Payment Link&quot; → Customize → Test Mode on a real reader&apos;s
            profile page, which generates a genuine payment_intent and link (requires PAYU_GATEWAY_ENABLED=true).
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
