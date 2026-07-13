"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeSubscriptionAction } from "../../billing/actions";
import { Button } from "@/components/ui/button";

export function CloseSubscriptionButton({ readerId, readerName }: { readerId: number; readerName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ error: string } | { message: string } | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              `Close ${readerName}'s subscription? This posts a final charge for everything accrued so far and marks them inactive. This cannot be undone from here.`
            )
          )
            return;
          setResult(null);
          startTransition(async () => {
            const res = await closeSubscriptionAction(readerId);
            setResult(res);
            router.refresh();
          });
        }}
      >
        {pending ? "Closing..." : "Close Subscription"}
      </Button>
      {result && "error" in result && <span className="text-xs text-destructive">{result.error}</span>}
      {result && "message" in result && <span className="text-xs text-muted-foreground">{result.message}</span>}
    </div>
  );
}
