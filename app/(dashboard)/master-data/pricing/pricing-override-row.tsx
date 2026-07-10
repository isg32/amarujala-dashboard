"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePricingOverrideAction, deletePricingOverrideAction } from "../actions";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteButton } from "../delete-button";

type Override = {
  id: number;
  scope: "global" | "unit" | "center";
  scopeLabel: string;
  dailyPrice: string;
  forDate: string | null;
  active: boolean;
};

export function PricingOverrideRow({ override }: { override: Override }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <TableRow>
        <TableCell className="capitalize">{override.scope}</TableCell>
        <TableCell>{override.scopeLabel}</TableCell>
        <TableCell>₹{override.dailyPrice}</TableCell>
        <TableCell>{override.forDate ?? "Ongoing"}</TableCell>
        <TableCell>{override.active ? "Yes" : "No"}</TableCell>
        <TableCell className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <DeleteButton
            action={deletePricingOverrideAction.bind(null, override.id)}
            confirmMessage={`Delete this ₹${override.dailyPrice}/day rate for ${override.scopeLabel}?`}
          />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell colSpan={6}>
        <form
          action={async (formData) => {
            setPending(true);
            setError(null);
            const result = await updatePricingOverrideAction(formData);
            setPending(false);
            if (result && "error" in result) setError(result.error);
            else {
              setEditing(false);
              router.refresh();
            }
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="id" value={override.id} />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {override.scope} — {override.scopeLabel} — {override.forDate ?? "Ongoing"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`dailyPrice-${override.id}`}>
              Daily price (₹)
            </label>
            <Input
              id={`dailyPrice-${override.id}`}
              name="dailyPrice"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={override.dailyPrice}
              className="w-28"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="active" defaultChecked={override.active} />
            Active
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          {error && <span className="text-xs text-destructive">{error}</span>}
        </form>
      </TableCell>
    </TableRow>
  );
}
