"use client";

import { useState, useTransition } from "react";
import { sendPaymentReminderAction } from "./reminder-actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";

export type ReminderMonth = { billingPeriod: string; due: number };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTH_NAMES[m - 1] ?? period} ${y}`;
}

export function SendReminderButton({
  readerId,
  months = [],
}: {
  readerId: number;
  /** Billing months with an outstanding balance — lets the sender target the
   * reminder at one month when the reader is several months behind. */
  months?: ReminderMonth[];
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error: string } | { message: string } | null>(null);
  const [period, setPeriod] = useState<string>("all");

  const send = () => {
    setResult(null);
    startTransition(async () => {
      setResult(await sendPaymentReminderAction(readerId, period === "all" ? undefined : period));
    });
  };

  return (
    <div className="flex flex-col gap-1 sm:items-end">
      <div className="flex flex-wrap items-center gap-1.5">
        {months.length > 0 && (
          <Select
            value={period}
            onValueChange={(v) => setPeriod(typeof v === "string" ? v : "all")}
            items={{
              all: "Full amount due",
              ...Object.fromEntries(months.map((m) => [m.billingPeriod, `${monthLabel(m.billingPeriod)} — ₹${m.due.toFixed(2)}`])),
            }}
          >
            <SelectTrigger size="sm" className="w-full sm:w-52">
              <SelectValue placeholder="Full amount due" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Full amount due</SelectItem>
                {months.map((m) => (
                  <SelectItem key={m.billingPeriod} value={m.billingPeriod}>
                    {monthLabel(m.billingPeriod)} — ₹{m.due.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={send}>
          {pending ? "Sending..." : "Send Payment Reminder"}
        </Button>
      </div>
      {result && "error" in result && <span className="max-w-56 text-right text-xs text-destructive">{result.error}</span>}
      {result && "message" in result && <span className="text-xs text-muted-foreground">{result.message}</span>}
    </div>
  );
}
