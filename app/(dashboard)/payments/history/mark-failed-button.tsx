"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPaymentIntentFailedAction } from "../actions";
import { Button } from "@/components/ui/button";

export function MarkFailedButton({ intentId }: { intentId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="xs"
        disabled={pending}
        onClick={() => {
          if (!confirm("Mark this link as failed? Use this for a stale/abandoned link the reader never paid.")) return;
          setError(null);
          startTransition(async () => {
            const result = await markPaymentIntentFailedAction(intentId);
            if (result && "error" in result) setError(result.error);
            else router.refresh();
          });
        }}
      >
        {pending ? "Updating..." : "Mark Failed"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
