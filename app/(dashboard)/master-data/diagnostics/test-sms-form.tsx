"use client";

import { useState, useTransition } from "react";
import { previewTestMessageAction, sendTestSmsAction } from "./actions";
import { Field, FieldLabel, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";

type TemplateType = "reminder" | "payment_link";

const FIELDS: Record<TemplateType, { key: string; label: string }[]> = {
  reminder: [
    { key: "name", label: "Customer name" },
    { key: "month", label: "Month" },
    { key: "amount", label: "Bill amount" },
    { key: "total", label: "Total due" },
    { key: "dueDate", label: "Due date (DD-MM-YYYY)" },
  ],
  payment_link: [
    { key: "name", label: "Customer name" },
    { key: "amount", label: "Amount" },
    { key: "startDate", label: "Bill period start (DD-MM-YYYY)" },
    { key: "endDate", label: "Bill period end (DD-MM-YYYY)" },
    { key: "payUrl", label: "Payment link URL" },
  ],
};

function formatDMY(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${d.getFullYear()}`;
}

function defaultVariables(type: TemplateType): Record<string, string> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shared = { name: "Test Customer", amount: "500.00" };
  if (type === "reminder") {
    return {
      ...shared,
      month: now.toLocaleString("en-US", { month: "long" }),
      total: "500.00",
      dueDate: formatDMY(monthEnd),
    };
  }
  return {
    ...shared,
    startDate: formatDMY(monthStart),
    endDate: formatDMY(monthEnd),
    payUrl: `${origin}/pay?id=TEST`,
  };
}

export function TestSmsForm() {
  const [type, setType] = useState<TemplateType>("payment_link");
  const [variables, setVariables] = useState<Record<string, string>>(() => defaultVariables("payment_link"));
  const [mobile, setMobile] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<{ error: string } | { message: string } | null>(null);
  const [previewPending, startPreviewTransition] = useTransition();
  const [sendPending, startSendTransition] = useTransition();

  function switchType(next: TemplateType) {
    setType(next);
    setVariables(defaultVariables(next));
    setPreview(null);
    setResult(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="type">Template</FieldLabel>
          <Select
            value={type}
            onValueChange={(v) => switchType((v as TemplateType) ?? "payment_link")}
            items={{ payment_link: "Payment Link", reminder: "Payment Reminder" }}
          >
            <SelectTrigger id="type" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="payment_link">Payment Link</SelectItem>
                <SelectItem value="reminder">Payment Reminder</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          {FIELDS[type].map((f) => (
            <Field key={f.key}>
              <FieldLabel htmlFor={f.key}>{f.label}</FieldLabel>
              <Input
                id={f.key}
                value={variables[f.key] ?? ""}
                onChange={(e) => setVariables((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>

        <Field>
          <FieldLabel htmlFor="mobile">Test mobile number</FieldLabel>
          <Input
            id="mobile"
            type="tel"
            placeholder="10-digit mobile number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-56"
          />
        </Field>
      </FieldGroup>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={previewPending}
          onClick={() => {
            setResult(null);
            startPreviewTransition(async () => {
              const res = await previewTestMessageAction(type, variables);
              setPreview("message" in res ? res.message : res.error);
            });
          }}
        >
          {previewPending ? "Loading..." : "Preview message"}
        </Button>
        <Button
          type="button"
          disabled={sendPending || !mobile}
          onClick={() => {
            setResult(null);
            startSendTransition(async () => {
              setResult(await sendTestSmsAction(type, mobile, variables));
            });
          }}
        >
          {sendPending ? "Sending..." : "Send Test SMS"}
        </Button>
      </div>

      {preview && <p className="rounded bg-muted p-3 text-sm">{preview}</p>}
      {result && "error" in result && <p className="text-sm text-destructive">{result.error}</p>}
      {result && "message" in result && <p className="text-sm text-primary">{result.message}</p>}
      <p className="text-xs text-muted-foreground">
        This uses the exact same send path as a real reminder/payment-link SMS — a success here means the SMS
        pipeline (credentials, template, provider) is genuinely working, not simulated.
      </p>
    </div>
  );
}
