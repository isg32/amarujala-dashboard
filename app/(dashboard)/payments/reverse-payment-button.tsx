"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reversePaymentAction } from "./actions";
import { Button } from "@/components/ui/button";

export function ReversePaymentButton({ paymentId }: { paymentId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) return <span className="text-xs text-muted-foreground">Reversed</span>;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={pending}
        onClick={() => {
          if (!confirm("Reverse this payment? This adds the amount back to the reader's balance.")) return;
          const reason = prompt("Reason for reversal (optional):") ?? undefined;
          startTransition(async () => {
            const result = await reversePaymentAction(paymentId, reason || undefined);
            if (result && "error" in result) {
              setError(result.error);
            } else {
              setDone(true);
              // revalidatePath() only invalidates the cache for future
              // navigations — the already-mounted page (outstanding
              // balance, ledger list) needs an explicit refresh to show it.
              router.refresh();
            }
          });
        }}
      >
        {pending ? "Reversing..." : "Reverse"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
