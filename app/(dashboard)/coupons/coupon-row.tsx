"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCouponAction, deleteCouponAction } from "./actions";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DeleteButton } from "../master-data/delete-button";

type Coupon = {
  id: number;
  code: string;
  description: string | null;
  discountAmount: string;
  totalBudget: string | null;
  active: boolean;
};

export function CouponRow({ coupon }: { coupon: Coupon }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <TableRow>
        <TableCell>{coupon.code}</TableCell>
        <TableCell>{coupon.description ?? "—"}</TableCell>
        <TableCell>₹{coupon.discountAmount}</TableCell>
        <TableCell>{coupon.totalBudget ? `₹${coupon.totalBudget}` : "Unlimited"}</TableCell>
        <TableCell>{coupon.active ? "Yes" : "No"}</TableCell>
        <TableCell className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <DeleteButton
            action={deleteCouponAction.bind(null, coupon.id)}
            confirmMessage={`Delete coupon "${coupon.code}"?`}
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
            const result = await updateCouponAction(formData);
            setPending(false);
            if (result && "error" in result) {
              setError(result.error);
            } else {
              setEditing(false);
              router.refresh();
            }
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="id" value={coupon.id} />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Code</span>
            <span className="text-sm">{coupon.code}</span>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`description-${coupon.id}`}>
              Description
            </label>
            <Input
              id={`description-${coupon.id}`}
              name="description"
              defaultValue={coupon.description ?? ""}
              className="w-48"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`discountAmount-${coupon.id}`}>
              Discount (₹)
            </label>
            <Input
              id={`discountAmount-${coupon.id}`}
              name="discountAmount"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={coupon.discountAmount}
              className="w-28"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`totalBudget-${coupon.id}`}>
              Total budget (₹, blank = unlimited)
            </label>
            <Input
              id={`totalBudget-${coupon.id}`}
              name="totalBudget"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={coupon.totalBudget ?? ""}
              className="w-32"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="active" defaultChecked={coupon.active} />
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
