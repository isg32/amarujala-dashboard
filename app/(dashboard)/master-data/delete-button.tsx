"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DeleteButton({
  action,
  confirmMessage,
  label = "Delete",
  pendingLabel = "Deleting...",
}: {
  action: () => Promise<{ error: string } | void>;
  confirmMessage: string;
  label?: string;
  pendingLabel?: string;
}) {
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
          if (!confirm(confirmMessage)) return;
          setError(null);
          startTransition(async () => {
            const result = await action();
            if (result && "error" in result) {
              setError(result.error);
            } else {
              router.refresh();
            }
          });
        }}
      >
        {pending ? pendingLabel : label}
      </Button>
      {error && <span className="max-w-40 text-right text-xs text-destructive">{error}</span>}
    </div>
  );
}
