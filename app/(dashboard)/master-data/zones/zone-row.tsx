"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateZoneAction, deleteZoneAction } from "../actions";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "../delete-button";

type Zone = { id: number; name: string };

export function ZoneRow({ zone }: { zone: Zone }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <TableRow>
        <TableCell>{zone.name}</TableCell>
        <TableCell className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <DeleteButton action={deleteZoneAction.bind(null, zone.id)} confirmMessage={`Delete zone "${zone.name}"?`} />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell colSpan={2}>
        <form
          action={async (formData) => {
            setPending(true);
            setError(null);
            const result = await updateZoneAction(formData);
            setPending(false);
            if (result && "error" in result) setError(result.error);
            else {
              setEditing(false);
              router.refresh();
            }
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="id" value={zone.id} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground" htmlFor={`name-${zone.id}`}>
              Zone name
            </label>
            <Input id={`name-${zone.id}`} name="name" defaultValue={zone.name} className="w-48" required />
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
