"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSmsTemplateAction, resetSmsTemplateAction } from "./actions";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SmsTemplateType } from "@/lib/sms/send-reminder";

type Template = {
  type: SmsTemplateType;
  template: string;
  defaultTemplate: string;
  isCustomized: boolean;
};

const TITLES: Record<SmsTemplateType, string> = {
  reminder: "Payment Reminder",
  payment_link: "Payment Link",
};

function extractTags(template: string): string[] {
  return [...new Set([...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
}

export function TemplateForm({ template }: { template: Template }) {
  const router = useRouter();
  const [value, setValue] = useState(template.template);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tags = extractTags(template.defaultTemplate);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <CardTitle>{TITLES[template.type]}</CardTitle>
          <CardDescription>Required placeholders: {tags.map((t) => `{${t}}`).join(", ")}</CardDescription>
        </div>
        {template.isCustomized && <Badge variant="secondary">Customized</Badge>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          className="font-mono text-sm"
        />
        <div className="flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              const formData = new FormData();
              formData.set("type", template.type);
              formData.set("template", value);
              const result = await updateSmsTemplateAction(formData);
              setPending(false);
              if (result && "error" in result) setError(result.error);
              else router.refresh();
            }}
          >
            {pending ? "Saving..." : "Save"}
          </Button>
          {template.isCustomized && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                setError(null);
                const result = await resetSmsTemplateAction(template.type);
                setPending(false);
                if (result && "error" in result) setError(result.error);
                else {
                  setValue(template.defaultTemplate);
                  router.refresh();
                }
              }}
            >
              Reset to registered default
            </Button>
          )}
          {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
