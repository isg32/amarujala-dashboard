"use client";

import { useState, useTransition } from "react";
import { sendPaymentReminderAction } from "./reminder-actions";
import { Button } from "@/components/ui/button";

export function SendReminderButton({ readerId }: { readerId: number }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error: string } | { message: string } | null>(null);

  return (
    <div className="flex flex-col gap-1 sm:items-end">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setResult(null);
          startTransition(async () => {
            setResult(await sendPaymentReminderAction(readerId));
          });
        }}
      >
        {pending ? "Sending..." : "Send Payment Reminder"}
      </Button>
      {result && "error" in result && <span className="max-w-56 text-right text-xs text-destructive">{result.error}</span>}
      {result && "message" in result && <span className="text-xs text-muted-foreground">{result.message}</span>}
    </div>
  );
}
