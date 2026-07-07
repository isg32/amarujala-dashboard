"use client";

import { useState, useTransition } from "react";
import { sendPaymentLinkAction } from "./actions";
import { Button } from "@/components/ui/button";

export function SendPaymentLinkButton({ readerId }: { readerId: number }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error: string } | { message: string } | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          setResult(null);
          startTransition(async () => {
            setResult(await sendPaymentLinkAction(readerId));
          });
        }}
      >
        {pending ? "Sending..." : "Send Payment Link"}
      </Button>
      {result && "error" in result && <span className="max-w-56 text-right text-xs text-destructive">{result.error}</span>}
      {result && "message" in result && <span className="text-xs text-muted-foreground">{result.message}</span>}
    </div>
  );
}
