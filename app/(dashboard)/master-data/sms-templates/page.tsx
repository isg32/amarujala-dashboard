import { requireAdmin } from "@/lib/auth/session";
import { listSmsTemplates } from "@/lib/data/sms-templates";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { TemplateForm } from "./template-form";

export default async function SmsTemplatesPage() {
  await requireAdmin();
  const templates = await listSmsTemplates();

  return (
    <div className="flex flex-col gap-6 overflow-x-auto">
      <Alert variant="destructive">
        <AlertTitle>Editing this can break SMS delivery</AlertTitle>
        <AlertDescription>
          Both messages below are registered word-for-word with the telecom DLT system through VISPL. Indian
          carriers scrub every outgoing message against that exact registered text — if what you save here no
          longer matches, real customers will simply stop receiving the SMS with no error shown here. Only the
          surrounding wording is safe to change; the <code>{"{placeholders}"}</code> must stay exactly as listed
          under each template (same names, can&apos;t add or remove any). If you do change the wording, you also
          need to re-register the new text with VISPL before it will actually deliver — use the &quot;Customize&quot;
          → &quot;Preview message&quot; and Test Mode tools on a reader&apos;s payment-link button to confirm real
          delivery before relying on this.
        </AlertDescription>
      </Alert>

      {templates.map((template) => (
        <TemplateForm key={template.type} template={template} />
      ))}
    </div>
  );
}
