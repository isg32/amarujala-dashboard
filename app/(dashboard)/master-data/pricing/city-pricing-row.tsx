"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCityPricingAction, deleteCityPricingAction } from "../actions";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "../delete-button";

type Row = { id: number; cityName: string; price: string; effectiveFrom: string };

export function CityPricingRow({ row }: { row: Row }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <TableRow>
        <TableCell>{row.cityName}</TableCell>
        <TableCell>₹{row.price}</TableCell>
        <TableCell>{row.effectiveFrom}</TableCell>
        <TableCell className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <DeleteButton
            action={deleteCityPricingAction.bind(null, row.id)}
            confirmMessage={`Delete this ₹${row.price} price entry for ${row.cityName}? Past billing already computed with it is unaffected.`}
          />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell colSpan={4}>
        <form
          action={async (formData) => {
            setPending(true);
            setError(null);
            const result = await updateCityPricingAction(formData);
            setPending(false);
            if (result && "error" in result) setError(result.error);
            else {
              setEditing(false);
              router.refresh();
            }
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="id" value={row.id} />
          <span className="text-xs text-muted-foreground">{row.cityName}</span>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`price-${row.id}`}>
              Monthly price (₹)
            </label>
            <Input
              id={`price-${row.id}`}
              name="price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={row.price}
              className="w-28"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`effectiveFrom-${row.id}`}>
              Effective from
            </label>
            <Input
              id={`effectiveFrom-${row.id}`}
              name="effectiveFrom"
              type="date"
              defaultValue={row.effectiveFrom}
              required
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
      </TableCell>
    </TableRow>
  );
}
