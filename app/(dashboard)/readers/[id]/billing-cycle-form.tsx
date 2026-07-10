"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateReaderBillingAnchorAction } from "../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function BillingCycleForm({ readerId, billingAnchorDay }: { readerId: number; billingAnchorDay: number | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span>
          {billingAnchorDay == null
            ? "Calendar month (default)"
            : `Custom cycle: day ${billingAnchorDay} of each month`}
        </span>
        <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        setPending(true);
        setError(null);
        const result = await updateReaderBillingAnchorAction(readerId, formData);
        setPending(false);
        if (result && "error" in result) setError(result.error);
        else {
          setEditing(false);
          router.refresh();
        }
      }}
      className="flex items-end gap-2"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground" htmlFor="billingAnchorDay">
          Anchor day (2–28, blank = calendar month)
        </label>
        <Input
          id="billingAnchorDay"
          name="billingAnchorDay"
          type="number"
          min="2"
          max="28"
          defaultValue={billingAnchorDay ?? ""}
          className="w-24"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
        Cancel
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  );
}
