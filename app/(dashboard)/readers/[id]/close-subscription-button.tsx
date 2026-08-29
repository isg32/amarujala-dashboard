"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeSubscriptionAction } from "../../billing/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatAmountDue } from "@/lib/billing/format";

interface CloseSubscriptionButtonProps {
  readerId: number;
  readerName: string;
  amountDue: number;
}

export function CloseSubscriptionButton({ readerId, readerName, amountDue }: CloseSubscriptionButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error: string } | { message: string } | null>(null);
  const [writeOff, setWriteOff] = useState(false);

  const pendingAmount = amountDue > 0 ? amountDue : 0;

  const handleClose = () => {
    let message = `Close ${readerName}'s subscription? `;
    if (writeOff && pendingAmount > 0) {
      message += `This will write off ₹${pendingAmount.toFixed(2)} as an adjustment (no charge posted). `;
    } else if (pendingAmount > 0) {
      message += `This will post a final charge of ₹${pendingAmount.toFixed(2)} for delivered papers. `;
    } else {
      message += `No outstanding balance. `;
    }
    message += `The reader will be marked inactive. This cannot be undone from here.`;

    if (!confirm(message)) return;

    setResult(null);
    startTransition(async () => {
      const res = await closeSubscriptionAction(readerId, writeOff && pendingAmount > 0);
      setResult(res);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      {pendingAmount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <span>Pending: <span className="font-medium">{formatAmountDue(pendingAmount)}</span></span>
          <Checkbox
            id="write-off-checkbox"
            checked={writeOff}
            onCheckedChange={setWriteOff}
            disabled={pending}
          />
          <label htmlFor="write-off-checkbox" className="cursor-pointer select-none">
            Write off as adjustment
          </label>
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={handleClose}
      >
        {pending ? "Closing..." : "Close Subscription"}
      </Button>
      {result && "error" in result && <span className="text-xs text-destructive">{result.error}</span>}
      {result && "message" in result && <span className="text-xs text-muted-foreground">{result.message}</span>}
    </div>
  );
}
