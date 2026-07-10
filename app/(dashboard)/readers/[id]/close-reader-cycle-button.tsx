"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closeReaderCycleAction } from "../../billing/actions";
import { Button } from "@/components/ui/button";

export function CloseReaderCycleButton({ readerId }: { readerId: number }) {
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
          setResult(null);
          startTransition(async () => {
            const res = await closeReaderCycleAction(readerId);
            setResult(res);
            router.refresh();
          });
        }}
      >
        {pending ? "Closing..." : "Close last completed cycle"}
      </Button>
      {result && "error" in result && <span className="text-xs text-destructive">{result.error}</span>}
      {result && "message" in result && <span className="text-xs text-muted-foreground">{result.message}</span>}
    </div>
  );
}
